import { join } from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { SkilletError } from '../errors';
import { expandPath } from '../registry/agents';
import { serialiseSkillFile } from '../scan/frontmatter';
import type { SkillFrontmatter } from '../scan/frontmatter.types';
import { getIndex } from '../scan/scanner';
import type { SkillInstance } from '../scan/walk.types';
import { appendEntry } from './journal';
import { assertInsideRoots, assertNotPlugin } from './preflight';
import { applySteps, captureFile, writeStep } from './steps';
import type { FsStep, OpResult } from './steps.types';

const SERVICE = 'TriggerService';

const CLAUDE_OVERRIDE_VALUES = ['on', 'name-only', 'user-invocable-only', 'off'];

export interface TriggerChanges {
  disableModelInvocation: boolean;
  userInvocable: boolean;
  paths: string[];
  claudeOverride: string;
  claudeOverrideScope: 'global' | 'project';
  codexEnabled: boolean;
}

export interface TriggerInput {
  skillId: string;
  agentId: string;
  changes: TriggerChanges;
  dryRun: boolean;
}

function requireInstance(skillId: string, agentId: string): SkillInstance {
  const index = getIndex();
  for (const skill of index.skills) {
    if (skill.id !== skillId) {
      continue;
    }
    for (const instance of skill.instances) {
      if (instance.readers.includes(agentId)) {
        return instance;
      }
    }
    for (const instance of skill.instances) {
      if (instance.id === skill.canonicalId) {
        return instance;
      }
    }
  }
  throw new SkilletError({
    message: `no instance for ${skillId} readable by ${agentId}`,
    method: 'requireInstance',
    service: SERVICE,
    error: null,
    code: 'NOT_FOUND',
    status: 404
  });
}

async function claudeSettingsSteps(
  instance: SkillInstance,
  changes: TriggerChanges
): Promise<{ steps: FsStep[]; inverse: FsStep[] }> {
  const steps: FsStep[] = [];
  const inverse: FsStep[] = [];
  if (changes.claudeOverride.length === 0) {
    return { steps, inverse };
  }
  if (!CLAUDE_OVERRIDE_VALUES.includes(changes.claudeOverride)) {
    throw new SkilletError({
      message: `invalid claude override: ${changes.claudeOverride}`,
      method: 'claudeSettingsSteps',
      service: SERVICE,
      error: null,
      code: 'VALIDATION',
      status: 400
    });
  }
  let base = expandPath('$CLAUDE_CONFIG_DIR');
  if (changes.claudeOverrideScope === 'project' && instance.repoId.length > 0) {
    base = join(instance.repoId, '.claude');
  }
  const file = join(base, 'settings.local.json');
  const previous = await captureFile(file);
  let data: Record<string, unknown> = {};
  if (previous.length > 0) {
    try {
      data = JSON.parse(previous) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  let overrides: Record<string, string> = {};
  const existing = data.skillOverrides;
  if (existing && typeof existing === 'object') {
    overrides = { ...(existing as Record<string, string>) };
  }
  if (changes.claudeOverride === 'on') {
    delete overrides[instance.name];
  } else {
    overrides[instance.name] = changes.claudeOverride;
  }
  if (Object.keys(overrides).length === 0) {
    delete data.skillOverrides;
  } else {
    data.skillOverrides = overrides;
  }
  steps.push(writeStep(file, `${JSON.stringify(data, null, 2)}\n`, `set skillOverrides in ${file}`));
  inverse.push(writeStep(file, previous, `restore ${file}`));
  return { steps, inverse };
}

async function codexSteps(skillName: string, enabled: boolean): Promise<{ steps: FsStep[]; inverse: FsStep[] }> {
  const file = join(expandPath('$CODEX_HOME'), 'config.toml');
  const previous = await captureFile(file);
  let data: Record<string, unknown> = {};
  if (previous.length > 0) {
    try {
      data = parseToml(previous) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  let skills: Record<string, unknown> = {};
  const existing = data.skills;
  if (existing && typeof existing === 'object') {
    skills = { ...(existing as Record<string, unknown>) };
  }
  const alreadyDisabled = skills[skillName] !== undefined;
  if (enabled && !alreadyDisabled) {
    return { steps: [], inverse: [] };
  }
  if (enabled) {
    delete skills[skillName];
  } else {
    skills[skillName] = { enabled: false };
  }
  if (Object.keys(skills).length === 0) {
    delete data.skills;
  } else {
    data.skills = skills;
  }
  const steps: FsStep[] = [writeStep(file, `${stringifyToml(data)}\n`, `set skills table in ${file}`)];
  const inverse: FsStep[] = [writeStep(file, previous, `restore ${file}`)];
  return { steps, inverse };
}

export async function setTrigger(input: TriggerInput): Promise<OpResult> {
  try {
    const instance = requireInstance(input.skillId, input.agentId);
    await assertNotPlugin(instance.absPath);
    await assertInsideRoots([instance.absPath]);

    const steps: FsStep[] = [];
    const inverse: FsStep[] = [];

    const nextFrontmatter: SkillFrontmatter = {
      ...instance.frontmatter,
      disableModelInvocation: input.changes.disableModelInvocation,
      userInvocable: input.changes.userInvocable,
      paths: input.changes.paths
    };
    const changedFrontmatter =
      instance.frontmatter.disableModelInvocation !== nextFrontmatter.disableModelInvocation ||
      instance.frontmatter.userInvocable !== nextFrontmatter.userInvocable ||
      instance.frontmatter.paths.join(',') !== nextFrontmatter.paths.join(',');

    if (changedFrontmatter) {
      const file = join(instance.absPath, 'SKILL.md');
      const previous = await captureFile(file);
      const raw = serialiseSkillFile(nextFrontmatter, instance.body);
      steps.push(writeStep(file, raw, 'update trigger frontmatter'));
      inverse.push(writeStep(file, previous, 'restore trigger frontmatter'));
    }

    const claude = await claudeSettingsSteps(instance, input.changes);
    for (const entry of claude.steps) {
      steps.push(entry);
    }
    for (const entry of claude.inverse) {
      inverse.push(entry);
    }

    if (input.agentId === 'codex') {
      const codex = await codexSteps(instance.name, input.changes.codexEnabled);
      for (const entry of codex.steps) {
        steps.push(entry);
      }
      for (const entry of codex.inverse) {
        inverse.push(entry);
      }
    }

    if (input.dryRun) {
      return { steps, applied: false, journalId: '' };
    }
    await applySteps(steps);
    const entry = await appendEntry({ action: 'trigger', skillId: input.skillId, steps }, inverse);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'trigger update failed', method: 'setTrigger', service: SERVICE, error });
  }
}
