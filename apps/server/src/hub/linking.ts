import { lstat, readlink, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { loadConfig } from '../config/config';
import { SkilletError } from '../errors';
import { resolveAgents } from '../registry/agents';
import type { Agent } from '../registry/agents.types';
import type { Skill } from '../scan/index.types';
import { getIndex } from '../scan/scanner';
import type { SkillInstance } from '../scan/walk.types';
import { appendEntry } from './journal';
import { assertFree, assertInsideRoots, assertNotPlugin, assertRealDir, assertSymlink } from './preflight';
import { applySteps, step, symlinkStep } from './steps';
import type { FsStep, OpResult } from './steps.types';

const SERVICE = 'LinkingService';
const HUB_AGENT_ID = 'hub';

export interface LinkTarget {
  agentId: string;
  scope: 'global' | 'project';
  repoId: string;
}

export interface LinkInput {
  skillId: string;
  target: LinkTarget;
  dryRun: boolean;
}

export interface UnlinkInput {
  skillId: string;
  instanceId: string;
  dryRun: boolean;
}

export interface CopyInput {
  skillId: string;
  target: LinkTarget;
  mode: 'link' | 'copy';
  dryRun: boolean;
}

export interface MoveInput {
  skillId: string;
  target: LinkTarget;
  keepLinkAtSource: boolean;
  dryRun: boolean;
}

function repoIdForPath(path: string): string {
  const index = getIndex();
  let best = '';
  for (const repo of index.repos) {
    if (!path.startsWith(`${repo.gitRoot}/`)) {
      continue;
    }
    if (repo.gitRoot.length > best.length) {
      best = repo.id;
    }
  }
  return best;
}

function requireSkill(skillId: string): Skill {
  const index = getIndex();
  for (const skill of index.skills) {
    if (skill.id === skillId) {
      return skill;
    }
  }
  throw new SkilletError({
    message: `skill not found: ${skillId}`,
    method: 'requireSkill',
    service: SERVICE,
    error: null,
    code: 'NOT_FOUND',
    status: 404
  });
}

function requireCanonical(skill: Skill): SkillInstance {
  for (const instance of skill.instances) {
    if (instance.id !== skill.canonicalId) {
      continue;
    }
    if (instance.kind === 'symlink') {
      throw new SkilletError({
        message: `every copy of ${skill.name} inside a scanned directory is a symlink, so there is no real directory here to change; the real content lives at ${instance.symlinkTarget}, outside the configured roots`,
        method: 'requireCanonical',
        service: SERVICE,
        error: null,
        code: 'NO_REAL_CANONICAL',
        status: 400
      });
    }
    return instance;
  }
  throw new SkilletError({
    message: 'canonical instance missing',
    method: 'requireCanonical',
    service: SERVICE,
    error: null,
    code: 'NOT_FOUND',
    status: 404
  });
}

async function requireAgent(agentId: string): Promise<Agent> {
  const config = await loadConfig();
  const agents = await resolveAgents(config);
  for (const agent of agents) {
    if (agent.id === agentId) {
      return agent;
    }
  }
  throw new SkilletError({
    message: `unknown agent: ${agentId}`,
    method: 'requireAgent',
    service: SERVICE,
    error: null,
    code: 'NOT_FOUND',
    status: 404
  });
}

async function readableCanonical(skill: Skill): Promise<SkillInstance> {
  const instance = skill.instances.find((entry) => entry.id === skill.canonicalId);
  if (!instance) return requireCanonical(skill);
  // A known symlink is a valid read source. Linking/copying must not move its external owner.
  if (instance.kind !== 'symlink') return instance;
  await assertInsideRoots([instance.absPath]);
  const source = await realpath(instance.absPath);
  await assertRealDir(source);
  return { ...instance, absPath: source };
}

async function targetParentDir(target: LinkTarget): Promise<string> {
  if (target.agentId === HUB_AGENT_ID) {
    if (target.scope !== 'global') {
      throw new SkilletError({
        message: 'the hub target is only valid with global scope',
        method: 'targetParentDir',
        service: SERVICE,
        error: null,
        code: 'VALIDATION',
        status: 400
      });
    }
    const config = await loadConfig();
    return config.hubPath;
  }
  const agent = await requireAgent(target.agentId);
  if (target.scope === 'global') {
    if (agent.resolvedGlobalDir.length === 0) {
      throw new SkilletError({
        message: `${agent.name} has no global skills directory`,
        method: 'targetParentDir',
        service: SERVICE,
        error: null,
        code: 'NO_GLOBAL_DIR',
        status: 400
      });
    }
    return agent.resolvedGlobalDir;
  }
  const index = getIndex();
  for (const repo of index.repos) {
    if (repo.id === target.repoId) {
      return join(repo.gitRoot, agent.projectDir);
    }
  }
  throw new SkilletError({
    message: `unknown repo: ${target.repoId}`,
    method: 'targetParentDir',
    service: SERVICE,
    error: null,
    code: 'NOT_FOUND',
    status: 400
  });
}

function shouldUseRelative(sourcePath: string, sourceRepoId: string, linkPath: string): boolean {
  if (sourceRepoId.length === 0) {
    return false;
  }
  const index = getIndex();
  for (const repo of index.repos) {
    if (repo.id !== sourceRepoId) {
      continue;
    }
    return sourcePath.startsWith(`${repo.gitRoot}/`) && linkPath.startsWith(`${repo.gitRoot}/`);
  }
  return false;
}

async function linkIsRelative(path: string): Promise<boolean> {
  try {
    const target = await readlink(path);
    return !isAbsolute(target);
  } catch {
    return false;
  }
}

export async function linkSkill(input: LinkInput): Promise<OpResult> {
  try {
    const skill = requireSkill(input.skillId);
    const canonical = await readableCanonical(skill);
    await assertNotPlugin(canonical.absPath);
    await assertRealDir(canonical.absPath);
    const parent = await targetParentDir(input.target);
    const linkPath = join(parent, skill.name);
    await assertInsideRoots([linkPath]);
    await assertFree(linkPath);

    const useRelative = shouldUseRelative(canonical.absPath, canonical.repoId, linkPath);
    const steps: FsStep[] = [
      step('mkdir', '', parent, `ensure ${parent}`),
      symlinkStep(canonical.absPath, linkPath, useRelative, `link ${linkPath}`)
    ];
    if (input.dryRun) {
      return { steps, applied: false, journalId: '' };
    }
    await applySteps(steps);
    const entry = await appendEntry({ action: 'link', skillId: input.skillId, steps }, [
      step('unlink', '', linkPath, `remove ${linkPath}`)
    ]);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'link failed', method: 'linkSkill', service: SERVICE, error });
  }
}

export async function unlinkInstance(input: UnlinkInput): Promise<OpResult> {
  try {
    const skill = requireSkill(input.skillId);
    let target: SkillInstance | null = null;
    for (const instance of skill.instances) {
      if (instance.id === input.instanceId) {
        target = instance;
        break;
      }
    }
    if (!target) {
      throw new SkilletError({
        message: `instance not found: ${input.instanceId}`,
        method: 'unlinkInstance',
        service: SERVICE,
        error: null,
        code: 'NOT_FOUND',
        status: 404
      });
    }
    await assertInsideRoots([target.absPath]);
    await assertSymlink(target.absPath);
    const steps: FsStep[] = [step('unlink', '', target.absPath, `remove ${target.absPath}`)];
    const useRelative = await linkIsRelative(target.absPath);
    if (input.dryRun) {
      return { steps, applied: false, journalId: '' };
    }
    await applySteps(steps);
    const entry = await appendEntry({ action: 'unlink', skillId: input.skillId, steps }, [
      symlinkStep(target.symlinkTarget, target.absPath, useRelative, `restore ${target.absPath}`)
    ]);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'unlink failed', method: 'unlinkInstance', service: SERVICE, error });
  }
}

export async function copySkill(input: CopyInput): Promise<OpResult> {
  try {
    if (input.mode === 'link') {
      return await linkSkill({ skillId: input.skillId, target: input.target, dryRun: input.dryRun });
    }
    const skill = requireSkill(input.skillId);
    const canonical = await readableCanonical(skill);
    await assertRealDir(canonical.absPath);
    const parent = await targetParentDir(input.target);
    const destination = join(parent, skill.name);
    await assertInsideRoots([destination]);
    await assertFree(destination);
    const steps: FsStep[] = [
      step('mkdir', '', parent, `ensure ${parent}`),
      step('copyDir', canonical.absPath, destination, `copy to ${destination}`)
    ];
    if (input.dryRun) {
      return { steps, applied: false, journalId: '' };
    }
    await applySteps(steps);
    const entry = await appendEntry({ action: 'copy', skillId: input.skillId, steps }, [
      step('removeDir', '', destination, `remove ${destination}`)
    ]);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'copy failed', method: 'copySkill', service: SERVICE, error });
  }
}

export async function moveSkill(input: MoveInput): Promise<OpResult> {
  try {
    const skill = requireSkill(input.skillId);
    const canonical = requireCanonical(skill);
    await assertNotPlugin(canonical.absPath);
    await assertRealDir(canonical.absPath);

    const parent = await targetParentDir(input.target);
    const destination = join(parent, skill.name);
    await assertInsideRoots([canonical.absPath, destination]);
    await assertFree(destination);

    const steps: FsStep[] = [
      step('mkdir', '', parent, `ensure ${parent}`),
      step('move', canonical.absPath, destination, `move to ${destination}`)
    ];
    const inverse: FsStep[] = [step('move', destination, canonical.absPath, 'move back')];

    const destinationRepoId = repoIdForPath(destination);
    for (const instance of skill.instances) {
      if (instance.kind !== 'symlink' || instance.symlinkTarget !== canonical.absPath || instance.scope === 'plugin') {
        continue;
      }
      const useRelative = shouldUseRelative(destination, destinationRepoId, instance.absPath);
      const wasRelative = await linkIsRelative(instance.absPath);
      steps.push(step('unlink', '', instance.absPath, `remove stale link ${instance.absPath}`));
      steps.push(symlinkStep(destination, instance.absPath, useRelative, `relink ${instance.absPath}`));
      inverse.push(step('unlink', '', instance.absPath, 'remove relinked symlink'));
      inverse.push(symlinkStep(canonical.absPath, instance.absPath, wasRelative, 'restore original symlink'));
    }

    if (input.keepLinkAtSource) {
      const sourceLink = join(dirname(canonical.absPath), skill.name);
      const useRelative = shouldUseRelative(destination, destinationRepoId, sourceLink);
      steps.push(symlinkStep(destination, sourceLink, useRelative, `leave link at ${sourceLink}`));
      inverse.unshift(step('unlink', '', sourceLink, 'remove source link'));
    }

    if (input.dryRun) {
      return { steps, applied: false, journalId: '' };
    }
    await applySteps(steps);
    const entry = await appendEntry({ action: 'move', skillId: input.skillId, steps }, inverse);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'move failed', method: 'moveSkill', service: SERVICE, error });
  }
}

/** One preflighted transaction for every distinct known global agent directory. */
export async function installEverywhere(input: { skillId: string; dryRun: boolean }): Promise<OpResult> {
  const skill = requireSkill(input.skillId);
  const agents = await resolveAgents(await loadConfig());
  const seen = new Set<string>();
  const steps: FsStep[] = [];
  for (const agent of agents) {
    if (!agent.resolvedGlobalDir) continue;
    const destination = join(agent.resolvedGlobalDir, skill.name);
    if (seen.has(destination)) continue;
    seen.add(destination);
    try { await lstat(destination); continue; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const preview = await copySkill({ skillId: skill.id, target: { agentId: agent.id, scope: 'global', repoId: '' }, mode: 'copy', dryRun: true });
    steps.push(...preview.steps);
  }
  if (input.dryRun || !steps.length) return { steps, applied: false, journalId: '' };
  await applySteps(steps);
  const inverse = steps.filter((entry) => entry.op === 'copyDir').map((entry) => step('removeDir', '', entry.to, 'remove installed copy'));
  const entry = await appendEntry({ action: 'install-all-agents', skillId: skill.id, steps }, inverse);
  return { steps, applied: true, journalId: entry.id };
}
