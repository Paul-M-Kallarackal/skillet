import type { Dirent } from 'node:fs';
import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SkilletError } from '../errors';
import { expandPath } from '../registry/agents';
import type { PluginDiscovery, PluginInfo, PluginSkillDir, StaleCache } from './plugins.types';

const SERVICE = 'PluginService';

interface InstalledRecord {
  installPath: string;
  version: string;
}

export function claudePluginsRoot(): string {
  return join(expandPath('$CLAUDE_CONFIG_DIR'), 'plugins');
}

async function listDirs(path: string): Promise<Dirent[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    const dirs: Dirent[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(entry);
      }
    }
    return dirs;
  } catch {
    return [];
  }
}

/** Total size of a folder tree in bytes; symlinks are counted as links, not followed. */
async function dirSize(path: string): Promise<number> {
  try {
    const info = await lstat(path);
    if (!info.isDirectory()) {
      return info.size;
    }
    const entries = await readdir(path);
    const sizes = await Promise.all(entries.map((entry) => dirSize(join(path, entry))));
    let total = 0;
    for (const size of sizes) {
      total += size;
    }
    return total;
  } catch {
    return 0;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function discoverPluginSkills(): Promise<PluginDiscovery> {
  try {
    const root = claudePluginsRoot();
    let installedText = '';
    let settingsText = '{}';
    try {
      installedText = await readFile(join(root, 'installed_plugins.json'), 'utf8');
    } catch {
      return { dirs: [], plugins: [], staleCaches: [] };
    }
    try {
      settingsText = await readFile(join(expandPath('$CLAUDE_CONFIG_DIR'), 'settings.json'), 'utf8');
    } catch {
      settingsText = '{}';
    }
    const installed = JSON.parse(installedText) as { plugins?: Record<string, InstalledRecord[]> };
    const settings = JSON.parse(settingsText) as { enabledPlugins?: Record<string, boolean> };
    const enabled = settings.enabledPlugins ?? {};

    const records: { key: string; record: InstalledRecord }[] = [];
    for (const [key, list] of Object.entries(installed.plugins ?? {})) {
      const record = list[0];
      if (record) {
        records.push({ key, record });
      }
    }

    const skillLists = await Promise.all(records.map((entry) => listDirs(join(entry.record.installPath, 'skills'))));
    const hasSkillDir = await Promise.all(records.map((entry) => isDirectory(join(entry.record.installPath, 'skills'))));

    const plugins: PluginInfo[] = [];
    const dirs: PluginSkillDir[] = [];
    const installedPaths = new Set<string>();
    for (let position = 0; position < records.length; position += 1) {
      const entry = records[position];
      if (!entry) {
        continue;
      }
      const at = entry.key.lastIndexOf('@');
      let name = entry.key;
      let marketplace = '';
      if (at > 0) {
        name = entry.key.slice(0, at);
        marketplace = entry.key.slice(at + 1);
      }
      const skillNames: string[] = [];
      for (const dir of skillLists[position] ?? []) {
        skillNames.push(dir.name);
      }
      const isEnabled = enabled[entry.key] === true;
      installedPaths.add(resolve(entry.record.installPath));
      plugins.push({ key: entry.key, name, marketplace, version: entry.record.version, enabled: isEnabled, installPath: entry.record.installPath, skillNames });
      if (isEnabled && hasSkillDir[position] === true) {
        dirs.push({ pluginName: entry.key, version: entry.record.version, parentDir: join(entry.record.installPath, 'skills') });
      }
    }

    // Cache layout: plugins/cache/<marketplace>/<plugin>/<version>/. A version folder no installed plugin
    // points at is left over from an update.
    const cacheRoot = join(root, 'cache');
    const candidates: { path: string; plugin: string; marketplace: string; version: string }[] = [];
    const marketplaces = await listDirs(cacheRoot);
    const pluginLists = await Promise.all(marketplaces.map((marketplace) => listDirs(join(cacheRoot, marketplace.name))));
    const versionJobs: { marketplace: string; plugin: string }[] = [];
    for (let position = 0; position < marketplaces.length; position += 1) {
      const marketplace = marketplaces[position];
      for (const plugin of pluginLists[position] ?? []) {
        if (marketplace) {
          versionJobs.push({ marketplace: marketplace.name, plugin: plugin.name });
        }
      }
    }
    const versionLists = await Promise.all(versionJobs.map((job) => listDirs(join(cacheRoot, job.marketplace, job.plugin))));
    for (let position = 0; position < versionJobs.length; position += 1) {
      const job = versionJobs[position];
      if (!job) {
        continue;
      }
      for (const version of versionLists[position] ?? []) {
        const path = join(cacheRoot, job.marketplace, job.plugin, version.name);
        if (!installedPaths.has(resolve(path))) {
          candidates.push({ path, plugin: job.plugin, marketplace: job.marketplace, version: version.name });
        }
      }
    }
    const sizes = await Promise.all(candidates.map((candidate) => dirSize(candidate.path)));
    const staleCaches: StaleCache[] = [];
    for (let position = 0; position < candidates.length; position += 1) {
      const candidate = candidates[position];
      if (candidate) {
        staleCaches.push({ ...candidate, bytes: sizes[position] ?? 0 });
      }
    }

    return { dirs, plugins, staleCaches };
  } catch (error) {
    throw new SkilletError({
      message: 'failed to discover plugin skills',
      method: 'discoverPluginSkills',
      service: SERVICE,
      error
    });
  }
}
