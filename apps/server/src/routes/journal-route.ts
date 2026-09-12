import { Hono } from 'hono';
import { SkilletError } from '../errors';
import { listEntries, undoLast } from '../hub/journal';
import { scanAll } from '../scan/scanner';

const SERVICE = 'JournalRoute';

export const journalRoute = new Hono();

journalRoute.get('/', async (c) => {
  try {
    const entries = await listEntries(50);
    return c.json({ entries });
  } catch (error) {
    throw new SkilletError({
      message: 'failed to list journal entries',
      method: 'listJournal',
      service: SERVICE,
      error
    });
  }
});

journalRoute.post('/undo', async (c) => {
  try {
    const entry = await undoLast();
    const index = await scanAll();
    return c.json({ entry, scannedAt: index.scannedAt });
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({
      message: 'undo failed',
      method: 'undo',
      service: SERVICE,
      error
    });
  }
});
