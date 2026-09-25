import { Hono } from 'hono';
import { SkilletError } from '../errors';
import { cleanStaleCaches, setPluginEnabled, uninstallPlugin } from '../hub/plugins';
import { scanAll } from '../scan/scanner';

const SERVICE = 'PluginsRoute';

export const pluginsRoute = new Hono();

function wrap(method: string, error: unknown): never {
  if (error instanceof SkilletError) {
    throw error;
  }
  throw new SkilletError({ message: `${method} failed`, method, service: SERVICE, error });
}

pluginsRoute.post('/clean-cache', async (c) => {
  try {
    const body = (await c.req.json()) as { dryRun: boolean };
    const result = await cleanStaleCaches({ dryRun: body.dryRun !== false });
    if (result.applied) {
      await scanAll();
    }
    return c.json(result);
  } catch (error) {
    wrap('cleanCache', error);
  }
});

pluginsRoute.post('/:key/enabled', async (c) => {
  try {
    const body = (await c.req.json()) as { enabled: boolean; dryRun: boolean };
    const result = await setPluginEnabled({ key: decodeURIComponent(c.req.param('key')), enabled: body.enabled === true, dryRun: body.dryRun !== false });
    if (result.applied) {
      await scanAll();
    }
    return c.json(result);
  } catch (error) {
    wrap('setPluginEnabled', error);
  }
});

pluginsRoute.post('/:key/uninstall', async (c) => {
  try {
    const body = (await c.req.json()) as { dryRun: boolean };
    const result = await uninstallPlugin({ key: decodeURIComponent(c.req.param('key')), dryRun: body.dryRun !== false });
    if (result.applied) {
      await scanAll();
    }
    return c.json(result);
  } catch (error) {
    wrap('uninstallPlugin', error);
  }
});
