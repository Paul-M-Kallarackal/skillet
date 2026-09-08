import { Hono } from 'hono';
import { SkilletError } from '../errors';
import { listTrash, purgeTrash, restoreTrash } from '../hub/trash';
import { scanAll } from '../scan/scanner';

const SERVICE = 'TrashRoute';

export const trashRoute = new Hono();

trashRoute.get('/', async (c) => {
  try {
    const entries = await listTrash();
    return c.json({ entries });
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'failed to list trash', method: 'listTrash', service: SERVICE, error });
  }
});

trashRoute.post('/:entryId/restore', async (c) => {
  try {
    const result = await restoreTrash(c.req.param('entryId'));
    await scanAll();
    return c.json(result);
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'restore failed', method: 'restoreTrash', service: SERVICE, error });
  }
});

trashRoute.delete('/:entryId', async (c) => {
  try {
    const result = await purgeTrash(c.req.param('entryId'));
    return c.json(result);
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'purge failed', method: 'purgeTrash', service: SERVICE, error });
  }
});
