import { Hono } from 'hono';
import { applyAdopt, planAdopt } from '../hub/adopt';
import type { AdoptDecision } from '../hub/adopt.types';
import { SkilletError } from '../errors';
import { scanAll } from '../scan/scanner';

const SERVICE = 'AdoptRoute';

export const adoptRoute = new Hono();

adoptRoute.post('/plan', async (c) => {
  try {
    const plan = await planAdopt();
    return c.json(plan);
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'adopt plan failed', method: 'planAdopt', service: SERVICE, error });
  }
});

adoptRoute.post('/apply', async (c) => {
  try {
    const body = (await c.req.json()) as { decisions: AdoptDecision[] };
    const result = await applyAdopt(body.decisions);
    const index = await scanAll();
    return c.json({ result, scannedAt: index.scannedAt });
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'adopt apply failed', method: 'applyAdopt', service: SERVICE, error });
  }
});
