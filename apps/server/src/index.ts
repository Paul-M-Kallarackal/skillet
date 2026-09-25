import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { isSkilletError } from './errors';
import { guardMutations, REQUIRED_CLIENT_HEADER } from './security';
import { adoptRoute } from './routes/adopt-route';
import { agentsRoute } from './routes/agents-route';
import { configRoute } from './routes/config-route';
import { catalogRoute } from './routes/catalog-route';
import { pluginsRoute } from './routes/plugins-route';
import { projectsRoute } from './routes/projects-route';
import { eventsRoute } from './routes/events-route';
import { indexRoute } from './routes/index-route';
import { journalRoute } from './routes/journal-route';
import { skillsRoute } from './routes/skills-route';
import { trashRoute } from './routes/trash-route';
import { scanAll } from './scan/scanner';
import { broadcast, startWatcher } from './scan/watcher';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: ['http://localhost:5180', 'http://127.0.0.1:5180'],
    allowHeaders: ['content-type', REQUIRED_CLIENT_HEADER],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE']
  })
);
app.use('*', guardMutations);
app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api', indexRoute);
app.route('/api/agents', agentsRoute);
app.route('/api/events', eventsRoute);
app.route('/api/skills', skillsRoute);
app.route('/api/trash', trashRoute);
app.route('/api/journal', journalRoute);
app.route('/api/adopt', adoptRoute);
app.route('/api/config', configRoute);
app.route('/api/catalog', catalogRoute);
app.route('/api/projects', projectsRoute);
app.route('/api/plugins', pluginsRoute);

app.onError((error, c) => {
  if (isSkilletError(error)) {
    const body = { code: error.code, message: error.message, method: error.method, service: error.service };
    return c.json(body, error.status as ContentfulStatusCode);
  }
  return c.json({ code: 'UNEXPECTED', message: error.message }, 500);
});

await scanAll();

startWatcher().catch((error: unknown) => {
  let message = 'watcher failed to start';
  if (error instanceof Error) {
    message = error.message;
  }
  broadcast('error', { message });
});

export default { hostname: '127.0.0.1', port: 5181, fetch: app.fetch, idleTimeout: 60 };
export { app };
