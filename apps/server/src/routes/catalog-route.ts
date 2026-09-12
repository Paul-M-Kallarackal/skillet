import { Hono } from 'hono';
import { installImport, previewImport, searchCatalog } from '../catalog/catalog';
import { scanAll } from '../scan/scanner';

export const catalogRoute = new Hono();
catalogRoute.get('/search', async (c) => c.json({ skills: await searchCatalog(c.req.query('q') ?? '') }));
catalogRoute.post('/preview', async (c) => {
  const body = await c.req.json<{ source?: unknown; slug?: unknown }>();
  return c.json(await previewImport(body.source, body.slug));
});
catalogRoute.post('/install', async (c) => {
  const body = await c.req.json<{ token?: unknown }>();
  const result = await installImport(body.token);
  const index = await scanAll();
  const skill = index.skills.find((entry) => entry.instances.some((instance) => instance.absPath === result.destination));
  return c.json({ ...result, skillId: skill?.id ?? '' });
});
