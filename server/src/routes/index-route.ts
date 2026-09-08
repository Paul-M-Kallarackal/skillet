import { Hono } from 'hono';
import { SkilletError } from '../errors';
import { getIndex, scanAll } from '../scan/scanner';

const SERVICE = 'IndexRoute';

export const indexRoute = new Hono();

indexRoute.get('/index', (c) => c.json(getIndex()));

indexRoute.post('/rescan', async (c) => {
  try {
    const index = await scanAll();
    return c.json(index);
  } catch (error) {
    throw new SkilletError({
      message: 'rescan failed',
      method: 'rescan',
      service: SERVICE,
      error
    });
  }
});
