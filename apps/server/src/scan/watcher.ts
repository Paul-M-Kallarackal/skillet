import { join } from 'node:path';
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { loadConfig } from '../config/config';
import { SkilletError } from '../errors';
import { expandPath, globalSkillDirs, resolveAgents } from '../registry/agents';
import { getIndex, scanAll } from './scanner';

const SERVICE = 'WatcherService';

type Listener = (event: string, data: unknown) => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | null = null;
let watcher: FSWatcher | null = null;

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function broadcast(event: string, data: unknown): void {
  for (const listener of listeners) {
    listener(event, data);
  }
}

async function watchTargets(): Promise<string[]> {
  const config = await loadConfig();
  const agents = await resolveAgents(config);
  const seen = new Set<string>();
  const targets: string[] = [];
  const add = (path: string) => {
    if (path.length === 0) {
      return;
    }
    if (seen.has(path)) {
      return;
    }
    seen.add(path);
    targets.push(path);
  };
  add(config.hubPath);
  add(join(expandPath('$CODEX_HOME'), 'config.toml'));
  for (const file of ['settings.json', 'settings.local.json']) {
    add(join(expandPath('$CLAUDE_CONFIG_DIR'), file));
    for (const repo of getIndex().repos) { add(join(repo.gitRoot, '.claude', file)); }
  }
  for (const file of ['opencode.json', 'opencode.jsonc']) {
    add(join(expandPath('$XDG_CONFIG_HOME/opencode'), file));
    for (const repo of getIndex().repos) { add(join(repo.gitRoot, file)); }
  }
  for (const dir of globalSkillDirs(agents)) {
    add(dir);
  }
  for (const skill of getIndex().skills) {
    for (const instance of skill.instances) {
      if (instance.scope === 'plugin') {
        continue;
      }
      add(instance.parentDir);
      if (instance.kind === 'symlink') add(instance.symlinkTarget);
    }
  }
  return targets;
}

function scheduleRescan(): void {
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    timer = null;
    scanAll()
      .then((index) => {
        broadcast('index', { scannedAt: index.scannedAt, skills: index.skills.length });
      })
      .catch((error: unknown) => {
        let message = 'rescan failed';
        if (error instanceof Error) {
          message = error.message;
        }
        broadcast('error', { message });
      });
  }, 400);
}

export async function startWatcher(): Promise<void> {
  try {
    const targets = await watchTargets();
    if (watcher) {
      await watcher.close();
      watcher = null;
    }
    const next = chokidar.watch(targets, {
      ignoreInitial: true,
      followSymlinks: false,
      usePolling: false
    });
    next.on('all', () => {
      scheduleRescan();
    });
    next.on('error', (error: unknown) => {
      let message = 'watcher error';
      if (error instanceof Error) {
        message = error.message;
      }
      broadcast('error', { message });
    });
    watcher = next;
  } catch (error) {
    throw new SkilletError({
      message: 'failed to start watcher',
      method: 'startWatcher',
      service: SERVICE,
      error
    });
  }
}
