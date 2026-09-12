import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { JOURNAL_PATH, SKILLET_HOME } from '../config/config.constants';
import { SkilletError } from '../errors';
import { applySteps, invertSteps } from './steps';
import type { FsStep, JournalEntry, JournalEntryInput } from './steps.types';

const SERVICE = 'JournalService';

export async function appendEntry(input: JournalEntryInput, inverse: FsStep[]): Promise<JournalEntry> {
  try {
    await mkdir(SKILLET_HOME, { recursive: true });
    let steps = inverse;
    if (steps.length === 0) {
      steps = invertSteps(input.steps);
    }
    const entry: JournalEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      action: input.action,
      skillId: input.skillId,
      steps: input.steps,
      inverse: steps
    };
    await appendFile(JOURNAL_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
  } catch (error) {
    throw new SkilletError({
      message: 'failed to append journal entry',
      method: 'appendEntry',
      service: SERVICE,
      error
    });
  }
}

export async function listEntries(limit: number): Promise<JournalEntry[]> {
  try {
    let text = '';
    try {
      text = await readFile(JOURNAL_PATH, 'utf8');
    } catch {
      return [];
    }
    const entries: JournalEntry[] = [];
    for (const line of text.split('\n')) {
      if (line.trim().length === 0) {
        continue;
      }
      try {
        entries.push(JSON.parse(line) as JournalEntry);
      } catch {
        continue;
      }
    }
    entries.reverse();
    return entries.slice(0, limit);
  } catch (error) {
    throw new SkilletError({
      message: 'failed to read journal',
      method: 'listEntries',
      service: SERVICE,
      error
    });
  }
}

export async function undoLast(): Promise<JournalEntry> {
  try {
    const entries = await listEntries(50);
    const last = entries[0];
    if (!last) {
      throw new SkilletError({
        message: 'nothing to undo',
        method: 'undoLast',
        service: SERVICE,
        error: null,
        code: 'EMPTY_JOURNAL',
        status: 400
      });
    }
    await applySteps(last.inverse);
    await appendEntry({ action: `undo:${last.action}`, skillId: last.skillId, steps: last.inverse }, last.steps);
    return last;
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({
      message: 'undo failed',
      method: 'undoLast',
      service: SERVICE,
      error
    });
  }
}
