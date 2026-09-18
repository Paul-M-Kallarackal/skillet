import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { loadConfig } from '../config/config';
import { SkilletError } from '../errors';
import { getIndex } from '../scan/scanner';
import type { SkillInstance } from '../scan/walk.types';
import { appendEntry } from './journal';
import { assertFree, assertInsideRoots } from './preflight';
import { applySteps, step, symlinkStep } from './steps';
import type { AdoptCandidate, AdoptDecision, AdoptGroup, AdoptPlan } from './adopt.types';
import type { FsStep, OpResult } from './steps.types';

const SERVICE = 'AdoptService';

function globalInstancesByName(): Map<string, SkillInstance[]> {
  const groups = new Map<string, SkillInstance[]>();
  for (const skill of getIndex().skills) {
    const globals = skill.instances.filter((instance) => instance.scope === 'global');
    if (globals.length) groups.set(skill.name, [...(groups.get(skill.name) ?? []), ...globals]);
  }
  return groups;
}

export async function planAdopt(): Promise<AdoptPlan> {
  try {
    const config = await loadConfig();
    const groups: AdoptGroup[] = [];

    for (const [name, instances] of globalInstancesByName()) {
      const candidates: AdoptCandidate[] = [];
      const hashes: string[] = [];
      let alreadyInHub = false;
      let suggested = '';
      for (const instance of instances) {
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
        const fingerprint = instance.contentHash || instance.id;
        if (instance.kind !== 'symlink' && !hashes.includes(fingerprint)) {
          hashes.push(fingerprint);
        }
      }
      if (suggested.length === 0) {
        let best: SkillInstance | null = null;
        for (const instance of instances) {
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
        name,
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
    const byInstanceId = new Map<string, SkillInstance>();
    const globalByName = globalInstancesByName();
    for (const instances of globalByName.values()) {
      for (const instance of instances) byInstanceId.set(instance.id, instance);
    }

    const steps: FsStep[] = [];
    const inverse: FsStep[] = [];
    steps.push(step('mkdir', '', config.hubPath, 'ensure hub'));

    const backupId = randomUUID();
    const freeChecks: string[] = [];
    const rootChecks: string[] = [];

    for (const decision of decisions) {
      const winner = byInstanceId.get(decision.winnerInstanceId);
      if (!winner || winner.name !== decision.name || winner.kind === 'symlink') {
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
        inverse.unshift(step('move', hubTarget, winner.absPath, `undo adopt ${decision.name}`));
        steps.push(symlinkStep(hubTarget, winner.absPath, false, 'link original installation to hub'));
        inverse.unshift(step('unlink', '', winner.absPath, 'remove adopted source link'));
      }

      const instances = globalByName.get(decision.name);
      if (!instances) {
        continue;
      }

      for (const instance of instances) {
        if (instance.id === winner.id) {
          continue;
        }
        if (instance.isHub) {
          continue;
        }
        if (instance.kind === 'symlink') {
          steps.push(step('unlink', '', instance.absPath, `drop stale link ${instance.absPath}`));
          inverse.unshift(symlinkStep(instance.symlinkTarget, instance.absPath, false, `restore link ${instance.absPath}`));
          steps.push(symlinkStep(hubTarget, instance.absPath, false, `relink ${instance.absPath}`));
          inverse.unshift(step('unlink', '', instance.absPath, `remove relink ${instance.absPath}`));
          continue;
        }
        const location = createHash('sha256').update(instance.absPath).digest('hex');
        const backupDir = join(config.hubPath, '.adopt-backup', backupId, location);
        freeChecks.push(join(backupDir, decision.name));
        steps.push(step('mkdir', '', backupDir, 'ensure adopt backup dir'));
        steps.push(step('move', instance.absPath, join(backupDir, decision.name), `back up duplicate ${instance.absPath}`));
        inverse.unshift(step('move', join(backupDir, decision.name), instance.absPath, `restore duplicate ${instance.absPath}`));
        steps.push(symlinkStep(hubTarget, instance.absPath, false, `link ${instance.absPath}`));
        inverse.unshift(step('unlink', '', instance.absPath, `remove link ${instance.absPath}`));
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
