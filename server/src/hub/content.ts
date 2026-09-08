import { basename, dirname, join } from 'node:path';
import { SkilletError } from '../errors';
import { parseSkillFile, serialiseSkillFile } from '../scan/frontmatter';
import type { SkillFrontmatter } from '../scan/frontmatter.types';
import type { Skill } from '../scan/index.types';
import { getIndex } from '../scan/scanner';
import type { SkillInstance } from '../scan/walk.types';
import { appendEntry } from './journal';
import { assertFree, assertInsideRoots, assertNotPlugin, assertRealDir } from './preflight';
import { applySteps, captureFile, step, symlinkStep, writeStep } from './steps';
import type { FsStep, OpResult } from './steps.types';

const SERVICE = 'ContentService';

export interface EditContentInput {
  skillId: string;
  instanceId: string;
  frontmatter: SkillFrontmatter;
  body: string;
  dryRun: boolean;
}

export interface RenameInput {
  skillId: string;
  newName: string;
  dryRun: boolean;
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

function findInstance(skillId: string, instanceId: string): SkillInstance {
  const skill = requireSkill(skillId);
  for (const instance of skill.instances) {
    if (instance.id === instanceId) {
      return instance;
    }
  }
  throw new SkilletError({
    message: `instance not found: ${instanceId}`,
    method: 'findInstance',
    service: SERVICE,
    error: null,
    code: 'NOT_FOUND',
    status: 404
  });
}

export async function editContent(input: EditContentInput): Promise<OpResult> {
  try {
    const instance = findInstance(input.skillId, input.instanceId);
    await assertNotPlugin(instance.absPath);
    await assertInsideRoots([instance.absPath]);

    const dirName = basename(instance.absPath);
    const raw = serialiseSkillFile(input.frontmatter, input.body);
    const validated = parseSkillFile(raw, dirName);
    const blocking: string[] = [];
    for (const error of validated.errors) {
      if (error.severity === 'error') {
        blocking.push(error.message);
      }
    }
    if (blocking.length > 0) {
      throw new SkilletError({
        message: `invalid skill: ${blocking.join('; ')}`,
        method: 'editContent',
        service: SERVICE,
        error: null,
        code: 'VALIDATION',
        status: 400
      });
    }

    const target = join(instance.absPath, 'SKILL.md');
    const steps: FsStep[] = [writeStep(target, raw, `write ${dirName}/SKILL.md`)];
    if (input.dryRun) {
      return { steps, applied: false, journalId: '' };
    }
    const previous = await captureFile(target);
    await applySteps(steps);
    const entry = await appendEntry({ action: 'edit-content', skillId: input.skillId, steps }, [
      writeStep(target, previous, `restore ${dirName}/SKILL.md`)
    ]);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({
      message: 'failed to edit skill content',
      method: 'editContent',
      service: SERVICE,
      error
    });
  }
}

export async function renameSkill(input: RenameInput): Promise<OpResult> {
  try {
    const target = requireSkill(input.skillId);
    if (target.scope === 'plugin') {
      throw new SkilletError({
        message: 'plugin skills are read-only',
        method: 'renameSkill',
        service: SERVICE,
        error: null,
        code: 'PLUGIN_READONLY',
        status: 400
      });
    }

    const probe = parseSkillFile(`---\nname: ${input.newName}\ndescription: x\n---\n`, input.newName);
    for (const error of probe.errors) {
      if (error.severity === 'error' && error.code.startsWith('NAME')) {
        throw new SkilletError({
          message: error.message,
          method: 'renameSkill',
          service: SERVICE,
          error: null,
          code: 'VALIDATION',
          status: 400
        });
      }
    }

    const canonical = requireCanonical(target);
    await assertRealDir(canonical.absPath);

    const newCanonicalPath = join(dirname(canonical.absPath), input.newName);
    await assertInsideRoots([canonical.absPath, newCanonicalPath]);
    await assertFree(newCanonicalPath);

    const steps: FsStep[] = [];
    const inverse: FsStep[] = [];
    steps.push(step('move', canonical.absPath, newCanonicalPath, `rename dir to ${input.newName}`));
    inverse.push(step('move', newCanonicalPath, canonical.absPath, 'restore dir name'));

    const renamedFrontmatter: SkillFrontmatter = { ...canonical.frontmatter, name: input.newName };
    const raw = serialiseSkillFile(renamedFrontmatter, canonical.body);
    const newSkillFile = join(newCanonicalPath, 'SKILL.md');
    steps.push(writeStep(newSkillFile, raw, 'update name field'));
    const previous = await captureFile(join(canonical.absPath, 'SKILL.md'));
    inverse.push(writeStep(join(canonical.absPath, 'SKILL.md'), previous, 'restore name field'));

    for (const instance of target.instances) {
      if (instance.kind !== 'symlink') {
        continue;
      }
      const newLinkPath = join(dirname(instance.absPath), input.newName);
      const useRelative = instance.scope === 'project';
      steps.push(step('unlink', '', instance.absPath, `remove stale link ${instance.absPath}`));
      steps.push(symlinkStep(newCanonicalPath, newLinkPath, useRelative, `relink ${newLinkPath}`));
      inverse.push(step('unlink', '', newLinkPath, 'remove relinked symlink'));
      inverse.push(symlinkStep(canonical.absPath, instance.absPath, useRelative, 'restore original symlink'));
    }

    if (input.dryRun) {
      return { steps, applied: false, journalId: '' };
    }
    await applySteps(steps);
    const entry = await appendEntry({ action: 'rename', skillId: input.skillId, steps }, inverse);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({
      message: 'failed to rename skill',
      method: 'renameSkill',
      service: SERVICE,
      error
    });
  }
}
