import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SkilletError } from '../errors';
import { CONFIG_PATH, DEFAULT_CONFIG, SKILLET_HOME } from './config.constants';
import type { SkilletConfig } from './config.types';

const SERVICE = 'ConfigService';

function merge(raw: Record<string, unknown>): SkilletConfig {
  const merged: SkilletConfig = { ...DEFAULT_CONFIG };
  if (typeof raw.hubPath === 'string' && raw.hubPath.length > 0) {
    merged.hubPath = raw.hubPath;
  }
  if (Array.isArray(raw.projectRoots)) {
    const roots: string[] = [];
    for (const entry of raw.projectRoots) {
      if (typeof entry === 'string' && entry.length > 0) {
        roots.push(entry);
      }
    }
    merged.projectRoots = roots;
  }
  if (typeof raw.maxDepth === 'number' && raw.maxDepth > 0) {
    merged.maxDepth = raw.maxDepth;
  }
  if (Array.isArray(raw.ignoreDirs)) {
    const dirs: string[] = [];
    for (const entry of raw.ignoreDirs) {
      if (typeof entry === 'string' && entry.length > 0) {
        dirs.push(entry);
      }
    }
    merged.ignoreDirs = dirs;
  }
  if (typeof raw.showAllAgents === 'boolean') {
    merged.showAllAgents = raw.showAllAgents;
  }
  if (Array.isArray(raw.customAgents)) {
    merged.customAgents = raw.customAgents as SkilletConfig['customAgents'];
  }
  return merged;
}

export async function loadConfig(): Promise<SkilletConfig> {
  try {
    await mkdir(SKILLET_HOME, { recursive: true });
    let text = '';
    try {
      text = await readFile(CONFIG_PATH, 'utf8');
    } catch {
      await writeFile(CONFIG_PATH, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
      return { ...DEFAULT_CONFIG };
    }
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return merge(parsed);
  } catch (error) {
    throw new SkilletError({
      message: 'failed to load skillet config',
      method: 'loadConfig',
      service: SERVICE,
      error
    });
  }
}

export async function saveConfig(patch: Partial<SkilletConfig>): Promise<SkilletConfig> {
  try {
    const current = await loadConfig();
    const next: SkilletConfig = { ...current, ...patch };
    await writeFile(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
  } catch (error) {
    throw new SkilletError({
      message: 'failed to save skillet config',
      method: 'saveConfig',
      service: SERVICE,
      error
    });
  }
}
