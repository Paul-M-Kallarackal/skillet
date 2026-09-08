import { basename, join } from 'node:path';
import { loadConfig } from '../config/config';
import { SkilletError } from '../errors';
import type { Skill } from '../scan/index.types';
import { getIndex } from '../scan/scanner';
import type { SkillInstance } from '../scan/walk.types';
import { appendEntry } from './journal';
import { assertFree, assertInsideRoots } from './preflight';
import { applySteps, step, symlinkStep } from './steps';
import type { AdoptCandidate, AdoptDecision, AdoptGroup, AdoptPlan } from './adopt.types';
import type { FsStep, OpResult } from './steps.types';

const SERVICE = 'AdoptService';

export async function planAdopt(): Promise<AdoptPlan> {
  try {
    const config = await loadConfig();
    const index = getIndex();
    const groups: AdoptGroup[] = [];

    for (const skill of index.skills) {
      if (skill.scope !== 'global') {
        continue;
      }
      const candidates: AdoptCandidate[] = [];
      const hashes: string[] = [];
      let alreadyInHub = false;
      let suggested = '';
      for (const instance of skill.instances) {
        if (instance.isHub) {
          alreadyInHub = true;
          suggested = instance.id;
        }
        candidates.push({
          instanceId: instance.id,
          absPath: instance.absPath,
          contentHash: instance.contentHash,
          readers: instance.readers,
          isSymlink: instance.kind === 'symlink'
        });
        if (instance.kind !== 'symlink' && !hashes.includes(instance.contentHash)) {
          hashes.push(instance.contentHash);
        }
      }
      if (suggested.length === 0) {
        let best: SkillInstance | null = null;
        for (const instance of skill.instances) {
          if (instance.kind === 'symlink') {
            continue;
          }
          if (!best) {
            best = instance;
            continue;
          }
          if (instance.files.length > best.files.length) {
            best = instance;
          }
        }
        if (best) {
          suggested = best.id;
        }
      }
      groups.push({
        name: skill.name,
        candidates,
        hashes,
        conflict: hashes.length > 1,
        suggestedInstanceId: suggested,
        alreadyInHub
      });
    }

    let identicalGroups = 0;
    let conflictGroups = 0;
    for (const group of groups) {
      if (group.conflict) {
        conflictGroups += 1;
        continue;
      }
      identicalGroups += 1;
    }

    return { hubPath: config.hubPath, groups, identicalGroups, conflictGroups };
  } catch (error) {
    throw new SkilletError({ message: 'adopt planning failed', method: 'planAdopt', service: SERVICE, error });
  }
}

export async function applyAdopt(decisions: AdoptDecision[]): Promise<OpResult> {
  try {
    const config = await loadConfig();
    const index = getIndex();
    const byInstanceId = new Map<string, SkillInstance>();
    const globalByName = new Map<string, Skill>();
    for (const skill of index.skills) {
      if (skill.scope === 'global') {
        globalByName.set(skill.name, skill);
      }
      for (const instance of skill.instances) {
        byInstanceId.set(instance.id, instance);
      }
    }

    const steps: FsStep[] = [];
    const inverse: FsStep[] = [];
    steps.push(step('mkdir', '', config.hubPath, 'ensure hub'));

    const freeChecks: string[] = [];
    const rootChecks: string[] = [];

    for (const decision of decisions) {
      const winner = byInstanceId.get(decision.winnerInstanceId);
      if (!winner) {
        throw new SkilletError({
          message: `winner instance not found: ${decision.winnerInstanceId}`,
          method: 'applyAdopt',
          service: SERVICE,
          error: null,
          code: 'NOT_FOUND',
          status: 404
        });
      }
      const hubTarget = join(config.hubPath, decision.name);
      rootChecks.push(winner.absPath);
      rootChecks.push(hubTarget);

      if (!winner.isHub) {
        freeChecks.push(hubTarget);
        steps.push(step('move', winner.absPath, hubTarget, `adopt ${decision.name} into hub`));
        inverse.push(step('move', hubTarget, winner.absPath, `undo adopt ${decision.name}`));
      }

      const skill = globalByName.get(decision.name);
      if (!skill) {
        continue;
      }

      for (const instance of skill.instances) {
        if (instance.id === winner.id) {
          continue;
        }
        if (instance.isHub) {
          continue;
        }
        if (instance.kind === 'symlink') {
          steps.push(step('unlink', '', instance.absPath, `drop stale link ${instance.absPath}`));
          inverse.push(symlinkStep(instance.symlinkTarget, instance.absPath, false, `restore link ${instance.absPath}`));
          steps.push(symlinkStep(hubTarget, instance.absPath, false, `relink ${instance.absPath}`));
          inverse.push(step('unlink', '', instance.absPath, `remove relink ${instance.absPath}`));
          continue;
        }
        const backupDir = join(config.hubPath, '.adopt-backup', decision.name, basename(instance.parentDir));
        steps.push(step('mkdir', '', backupDir, 'ensure adopt backup dir'));
        steps.push(step('move', instance.absPath, join(backupDir, decision.name), `back up duplicate ${instance.absPath}`));
        inverse.push(step('move', join(backupDir, decision.name), instance.absPath, `restore duplicate ${instance.absPath}`));
        steps.push(symlinkStep(hubTarget, instance.absPath, false, `link ${instance.absPath}`));
        inverse.push(step('unlink', '', instance.absPath, `remove link ${instance.absPath}`));
      }
    }

    await assertInsideRoots(rootChecks);
    await Promise.all(freeChecks.map((path) => assertFree(path)));

    await applySteps(steps);
    const entry = await appendEntry({ action: 'adopt', skillId: 'adopt', steps }, inverse);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'adopt failed', method: 'applyAdopt', service: SERVICE, error });
  }
}
