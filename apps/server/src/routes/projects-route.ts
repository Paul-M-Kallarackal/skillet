import { Hono } from 'hono';
import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { loadConfig, saveConfig } from '../config/config';
import { discoverRepos } from '../scan/git';
import { scanAll } from '../scan/scanner';
import { startWatcher } from '../scan/watcher';
import { SkilletError } from '../errors';

export const projectsRoute = new Hono();
projectsRoute.get('/', async (c) => {
  const config = await loadConfig();
  const roots = [...new Set([...config.projectRoots, join(homedir(), 'Desktop'), join(homedir(), 'Projects')])];
  return c.json({ repos: await discoverRepos(roots, config.ignoreDirs, 4) });
});
projectsRoute.post('/', async (c) => {
  const body = await c.req.json<{ path?: unknown }>();
  const invalid = () => new SkilletError({ message: 'Choose an existing Git repository, or enter its full folder path.', service: 'Projects', method: 'add', error: null, status: 400 });
  if (typeof body.path !== 'string' || !isAbsolute(body.path)) throw invalid();
  let root: string;
  try { root = await realpath(body.path); await stat(join(root, '.git')); } catch { throw invalid(); }
  const config = await loadConfig();
  const repos = await discoverRepos([root], config.ignoreDirs, 0);
  if (!repos.some((repo) => repo.gitRoot === root)) throw invalid();
  await saveConfig({ projectRoots: [...new Set([...config.projectRoots, root])] });
  const index = await scanAll();
  await startWatcher();
  return c.json({ repos: index.repos, selectedId: index.repos.find((repo) => repo.gitRoot === root)?.id ?? '' });
});
