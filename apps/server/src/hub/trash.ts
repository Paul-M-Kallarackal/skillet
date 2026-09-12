import { readdir, readFile, readlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { TRASH_PATH } from '../config/config.constants';
import { SkilletError } from '../errors';
import type { Skill } from '../scan/index.types';
import { getIndex } from '../scan/scanner';
import type { SkillInstance } from '../scan/walk.types';
import { appendEntry } from './journal';
import { assertInsideRoots, assertNotPlugin, assertRealDir, assertSymlink } from './preflight';
import { applySteps, step, symlinkStep, writeStep } from './steps';
import type { FsStep, OpResult } from './steps.types';

const SERVICE = 'TrashService';

interface TrashedLink {
  path: string;
  relative: boolean;
}

export interface TrashEntry {
  id: string;
  name: string;
  trashedAt: string;
  originPath: string;
  trashPath: string;
  removedLinks: TrashedLink[];
}

export interface TrashInput {
  skillId: string;
  instanceId?: string;
  dryRun: boolean;
}

function manifestPath(entryId: string): string {
  return join(TRASH_PATH, entryId, 'skillet-trash.json');
}

async function linkIsRelative(path: string): Promise<boolean> {
  try {
    const target = await readlink(path);
    return !isAbsolute(target);
  } catch {
    return false;
  }
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

export async function trashSkill(input: TrashInput): Promise<OpResult> {
  try {
    const skill = requireSkill(input.skillId);
    if (skill.scope === 'plugin') {
      throw new SkilletError({
        message: 'plugin skills are read-only',
        method: 'trashSkill',
        service: SERVICE,
        error: null,
        code: 'PLUGIN_READONLY',
        status: 400
      });
    }
    const canonical = input.instanceId ? skill.instances.find((instance) => instance.id === input.instanceId) : requireCanonical(skill);
    if (!canonical) throw new SkilletError({ message: 'Installation not found', method: 'trashSkill', service: SERVICE, error: null, status: 404 });
    await assertNotPlugin(canonical.absPath);
    await assertRealDir(canonical.absPath);
    await assertInsideRoots([canonical.absPath]);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const entryId = `${stamp}-${crypto.randomUUID().slice(0, 8)}-${skill.name}`;
    const entryDir = join(TRASH_PATH, entryId);
    const trashPath = join(entryDir, skill.name);

    const inverse: FsStep[] = [];
    const removedLinks: TrashedLink[] = [];

    const symlinks: SkillInstance[] = [];
    for (const instance of skill.instances) {
      if (instance.kind === 'symlink' && (!input.instanceId || instance.symlinkTarget === canonical.absPath)) {
        symlinks.push(instance);
      }
    }
    await Promise.all(symlinks.map((instance) => assertSymlink(instance.absPath)));
    const linkForms = await Promise.all(symlinks.map((instance) => linkIsRelative(instance.absPath)));

    for (let index = 0; index < symlinks.length; index += 1) {
      const instance = symlinks[index];
      if (!instance) {
        continue;
      }
      let useRelative = false;
      if (linkForms[index] === true) {
        useRelative = true;
      }
      removedLinks.push({ path: instance.absPath, relative: useRelative });
      inverse.push(symlinkStep(canonical.absPath, instance.absPath, useRelative, `restore link ${instance.absPath}`));
    }

    const manifest: TrashEntry = {
      id: entryId,
      name: skill.name,
      trashedAt: new Date().toISOString(),
      originPath: canonical.absPath,
      trashPath,
      removedLinks
    };

    const steps: FsStep[] = [
      step('mkdir', '', entryDir, `create trash entry ${entryId}`),
      writeStep(manifestPath(entryId), `${JSON.stringify(manifest, null, 2)}\n`, 'write trash manifest first')
    ];
    for (const link of removedLinks) {
      steps.push(step('unlink', '', link.path, `remove link ${link.path}`));
    }
    steps.push(step('move', canonical.absPath, trashPath, `move to trash ${trashPath}`));
    inverse.push(step('move', trashPath, canonical.absPath, 'restore from trash'));

    if (input.dryRun) {
      return { steps, applied: false, journalId: '' };
    }
    await applySteps(steps);
    const entry = await appendEntry({ action: 'trash', skillId: input.skillId, steps }, inverse);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'trash failed', method: 'trashSkill', service: SERVICE, error });
  }
}

export async function listTrash(): Promise<TrashEntry[]> {
  try {
    let dirs: string[] = [];
    try {
      dirs = await readdir(TRASH_PATH, { encoding: 'utf8' });
    } catch {
      return [];
    }
    const names: string[] = [];
    for (const name of dirs) {
      if (name.startsWith('.')) {
        continue;
      }
      names.push(name);
    }
    const texts = await Promise.all(
      names.map(async (name) => {
        try {
          return await readFile(manifestPath(name), 'utf8');
        } catch {
          return '';
        }
      })
    );
    const entries: TrashEntry[] = [];
    for (const text of texts) {
      if (text.length === 0) {
        continue;
      }
      try {
        entries.push(JSON.parse(text) as TrashEntry);
      } catch {
        continue;
      }
    }
    entries.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
    return entries;
  } catch (error) {
    throw new SkilletError({ message: 'failed to list trash', method: 'listTrash', service: SERVICE, error });
  }
}

export async function restoreTrash(entryId: string): Promise<OpResult> {
  try {
    const entries = await listTrash();
    let entry: TrashEntry | null = null;
    for (const candidate of entries) {
      if (candidate.id === entryId) {
        entry = candidate;
        break;
      }
    }
    if (!entry) {
      throw new SkilletError({
        message: `trash entry not found: ${entryId}`,
        method: 'restoreTrash',
        service: SERVICE,
        error: null,
        code: 'NOT_FOUND',
        status: 404
      });
    }
    await assertInsideRoots([entry.originPath]);
    const steps: FsStep[] = [step('move', entry.trashPath, entry.originPath, `restore ${entry.name}`)];
    for (const link of entry.removedLinks) {
      steps.push(symlinkStep(entry.originPath, link.path, link.relative, `restore link ${link.path}`));
    }
    steps.push(step('removeDir', '', join(TRASH_PATH, entryId), 'clear trash entry'));
    await applySteps(steps);
    const journalEntry = await appendEntry({ action: 'restore', skillId: entry.name, steps }, []);
    return { steps, applied: true, journalId: journalEntry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'restore failed', method: 'restoreTrash', service: SERVICE, error });
  }
}

export async function purgeTrash(entryId: string): Promise<OpResult> {
  try {
    const target = join(TRASH_PATH, entryId);
    await assertInsideRoots([target]);
    const steps: FsStep[] = [step('removeDir', '', target, `purge ${entryId}`)];
    await applySteps(steps);
    return { steps, applied: true, journalId: '' };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'purge failed', method: 'purgeTrash', service: SERVICE, error });
  }
}
