import { cp, mkdir, readFile, readlink, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { SkilletError } from '../errors';
import type { FsStep, FsStepOp } from './steps.types';

const SERVICE = 'StepService';

export function step(op: FsStepOp, from: string, to: string, note: string): FsStep {
  return { op, from, to, content: '', relative: false, note };
}

export function writeStep(to: string, content: string, note: string): FsStep {
  return { op: 'writeFile', from: '', to, content, relative: false, note };
}

export function symlinkStep(target: string, link: string, useRelative: boolean, note: string): FsStep {
  return { op: 'symlink', from: target, to: link, content: '', relative: useRelative, note };
}

async function applyOne(current: FsStep): Promise<FsStep[]> {
  const rollback: FsStep[] = [];
  if (current.op === 'mkdir') {
    await mkdir(current.to, { recursive: true });
    return rollback;
  }
  if (current.op === 'move') {
    await mkdir(dirname(current.to), { recursive: true });
    await rename(current.from, current.to);
    rollback.push(step('move', current.to, current.from, `roll back move of ${current.to}`));
    return rollback;
  }
  if (current.op === 'symlink') {
    await mkdir(dirname(current.to), { recursive: true });
    let target = current.from;
    if (current.relative) {
      target = relative(dirname(current.to), current.from);
    }
    await symlink(target, current.to);
    rollback.push(step('unlink', '', current.to, `roll back symlink ${current.to}`));
    return rollback;
  }
  if (current.op === 'unlink') {
    let previousTarget = '';
    let wasRelative = false;
    try {
      previousTarget = await readlink(current.to);
      wasRelative = !isAbsolute(previousTarget);
    } catch {
      previousTarget = '';
    }
    await unlink(current.to);
    if (previousTarget.length > 0) {
      let absoluteTarget = previousTarget;
      if (wasRelative) {
        absoluteTarget = resolve(dirname(current.to), previousTarget);
      }
      rollback.push(symlinkStep(absoluteTarget, current.to, wasRelative, `roll back unlink of ${current.to}`));
    }
    return rollback;
  }
  if (current.op === 'writeFile') {
    let previous = '';
    let existed = true;
    try {
      previous = await readFile(current.to, 'utf8');
    } catch {
      existed = false;
    }
    await mkdir(dirname(current.to), { recursive: true });
    await writeFile(current.to, current.content, 'utf8');
    if (existed) {
      rollback.push(writeStep(current.to, previous, `roll back write of ${current.to}`));
    } else {
      rollback.push(step('unlink', '', current.to, `roll back created file ${current.to}`));
    }
    return rollback;
  }
  if (current.op === 'copyDir') {
    await cp(current.from, current.to, { recursive: true, dereference: true });
    rollback.push(step('removeDir', '', current.to, `roll back copy ${current.to}`));
    return rollback;
  }
  if (current.op === 'removeDir') {
    await rm(current.to, { recursive: true, force: true });
    return rollback;
  }
  return rollback;
}

async function rollBack(steps: FsStep[]): Promise<string[]> {
  const failures: string[] = [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const current = steps[index];
    if (!current) {
      continue;
    }
    try {
      await applyOne(current);
    } catch (error) {
      let detail = 'unknown error';
      if (error instanceof Error) {
        detail = error.message;
      }
      failures.push(`${current.op} ${current.to}: ${detail}`);
    }
  }
  return failures;
}

export async function applySteps(steps: FsStep[]): Promise<void> {
  const done: FsStep[] = [];
  try {
    for (const current of steps) {
      const rollback = await applyOne(current);
      for (const entry of rollback) {
        done.push(entry);
      }
    }
  } catch (error) {
    const failures = await rollBack(done);
    let message = 'failed to apply filesystem steps, rolled back cleanly';
    if (failures.length > 0) {
      message = `failed to apply filesystem steps and the rollback was incomplete: ${failures.join('; ')}`;
    }
    throw new SkilletError({
      message,
      method: 'applySteps',
      service: SERVICE,
      error,
      code: 'APPLY_FAILED'
    });
  }
}

export async function captureFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

export function invertSteps(steps: FsStep[]): FsStep[] {
  const inverse: FsStep[] = [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const current = steps[index];
    if (!current) {
      continue;
    }
    if (current.op === 'move') {
      inverse.push(step('move', current.to, current.from, `undo move ${current.note}`));
      continue;
    }
    if (current.op === 'symlink') {
      inverse.push(step('unlink', '', current.to, `undo symlink ${current.note}`));
      continue;
    }
    if (current.op === 'unlink') {
      inverse.push(symlinkStep(current.from, current.to, current.relative, `restore symlink ${current.note}`));
      continue;
    }
    if (current.op === 'copyDir') {
      inverse.push(step('removeDir', '', current.to, `undo copy ${current.note}`));
      continue;
    }
    if (current.op === 'writeFile') {
      inverse.push(writeStep(current.to, current.content, `restore content ${current.note}`));
      continue;
    }
    if (current.op === 'mkdir') {
      continue;
    }
    if (current.op === 'removeDir') {
      inverse.push(step('mkdir', '', current.to, 'cannot restore removed directory'));
    }
  }
  return inverse;
}
