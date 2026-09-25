import { Hono } from 'hono';
import { loadConfig, saveConfig } from '../config/config';
import { UI_ONLY_CONFIG_KEYS } from '../config/config.constants';
import type { SkilletConfig } from '../config/config.types';
import { SkilletError } from '../errors';
import { scanAll } from '../scan/scanner';
import { startWatcher } from '../scan/watcher';

const SERVICE = 'ConfigRoute';

export const configRoute = new Hono();

configRoute.get('/', async (c) => {
  try {
    const config = await loadConfig();
    return c.json({ config });
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'failed to load config', method: 'getConfig', service: SERVICE, error });
  }
});

configRoute.put('/', async (c) => {
  try {
    const body = (await c.req.json()) as { patch: Partial<SkilletConfig> };
    const config = await saveConfig(body.patch);
    const patchKeys = Object.keys(body.patch);
    let uiOnly = patchKeys.length > 0;
    for (const key of patchKeys) {
      if (!UI_ONLY_CONFIG_KEYS.includes(key)) {
        uiOnly = false;
      }
    }
    if (uiOnly) {
      return c.json({ config, scannedAt: null });
    }
    const index = await scanAll();
    await startWatcher();
    return c.json({ config, scannedAt: index.scannedAt });
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'failed to save config', method: 'putConfig', service: SERVICE, error });
  }
});
