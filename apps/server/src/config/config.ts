import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SkilletError } from '../errors';
import { CONFIG_PATH, DEFAULT_APPEARANCE, DEFAULT_CONFIG, SKILLET_HOME } from './config.constants';
import type { AppearanceConfig, SkilletConfig } from './config.types';

const SERVICE = 'ConfigService';

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

function readStringList(value: unknown): string[] {
  const out: string[] = [];
  if (!Array.isArray(value)) {
    return out;
  }
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      out.push(entry);
    }
  }
  return out;
}

function readHex(value: unknown, fallback: string): string {
  if (typeof value === 'string' && HEX_COLOUR.test(value)) {
    return value.toUpperCase();
  }
  return fallback;
}

function mergeAppearance(raw: unknown): AppearanceConfig {
  const merged: AppearanceConfig = { ...DEFAULT_APPEARANCE };
  if (!raw || typeof raw !== 'object') {
    return merged;
  }
  const source = raw as Record<string, unknown>;
  if (typeof source.preset === 'string' && source.preset.length > 0) {
    merged.preset = source.preset;
  }
  merged.accent = readHex(source.accent, DEFAULT_APPEARANCE.accent);
  merged.sidebar = readHex(source.sidebar, DEFAULT_APPEARANCE.sidebar);
  merged.gradientFrom = readHex(source.gradientFrom, DEFAULT_APPEARANCE.gradientFrom);
  merged.gradientTo = readHex(source.gradientTo, DEFAULT_APPEARANCE.gradientTo);
  if (typeof source.gradient === 'boolean') {
    merged.gradient = source.gradient;
  }
  if (source.density === 'compact') {
    merged.density = 'compact';
  }
  return merged;
}

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
  if (Array.isArray(raw.sidebarAgents)) {
    merged.sidebarAgents = readStringList(raw.sidebarAgents);
  }
  if (Array.isArray(raw.sidebarRepos)) {
    merged.sidebarRepos = readStringList(raw.sidebarRepos);
  }
  merged.appearance = mergeAppearance(raw.appearance);
  if (typeof raw.scanRuntimeDirs === 'boolean') {
    merged.scanRuntimeDirs = raw.scanRuntimeDirs;
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
    next.appearance = mergeAppearance(next.appearance);
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
