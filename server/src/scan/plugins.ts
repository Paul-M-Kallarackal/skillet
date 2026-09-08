import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { SkilletError } from '../errors';
import { expandPath } from '../registry/agents';
import type { PluginDiscovery, PluginSkillDir } from './plugins.types';

const SERVICE = 'PluginService';

interface InstalledRecord {
  installPath: string;
  version: string;
}

export async function discoverPluginSkills(): Promise<PluginDiscovery> {
  try {
    const claudeHome = expandPath('$CLAUDE_CONFIG_DIR');
    const installedPath = join(claudeHome, 'plugins', 'installed_plugins.json');
    const settingsPath = join(claudeHome, 'settings.json');

    let installedText = '';
    let settingsText = '';
    try {
      installedText = await readFile(installedPath, 'utf8');
    } catch {
      return { dirs: [], staleVersions: 0 };
    }
    try {
      settingsText = await readFile(settingsPath, 'utf8');
    } catch {
      settingsText = '{}';
    }

    const installed = JSON.parse(installedText) as { plugins: Record<string, InstalledRecord[]> };
    const settings = JSON.parse(settingsText) as { enabledPlugins: Record<string, boolean> };
    let enabled: Record<string, boolean> = {};
    if (settings.enabledPlugins) {
      enabled = settings.enabledPlugins;
    }

    const dirs: PluginSkillDir[] = [];
    const activePaths = new Set<string>();
    const candidates: PluginSkillDir[] = [];

    let installedPlugins: Record<string, InstalledRecord[]> = {};
    if (installed.plugins) {
      installedPlugins = installed.plugins;
    }
    for (const [key, records] of Object.entries(installedPlugins)) {
      if (enabled[key] !== true) {
        continue;
      }
      const record = records[0];
      if (!record) {
        continue;
      }
      const parentDir = join(record.installPath, 'skills');
      activePaths.add(parentDir);
      candidates.push({ pluginName: key, version: record.version, parentDir });
    }

    const checks = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const info = await stat(candidate.parentDir);
          if (info.isDirectory()) {
            return candidate;
          }
          return null;
        } catch {
          return null;
        }
      })
    );
    for (const hit of checks) {
      if (hit) {
        dirs.push(hit);
      }
    }

    let staleVersions = 0;
    const cacheRoot = join(claudeHome, 'plugins', 'cache');
    let marketplaces: Dirent[] = [];
    try {
      marketplaces = await readdir(cacheRoot, { withFileTypes: true });
    } catch {
      marketplaces = [];
    }
    const versionDirLists = await Promise.all(
      marketplaces.map(async (marketplace) => {
        if (!marketplace.isDirectory()) {
          return [] as string[];
        }
        const marketplacePath = join(cacheRoot, marketplace.name);
        let plugins: Dirent[] = [];
        try {
          plugins = await readdir(marketplacePath, { withFileTypes: true });
        } catch {
          return [] as string[];
        }
        const inner = await Promise.all(
          plugins.map(async (plugin) => {
            if (!plugin.isDirectory()) {
              return [] as string[];
            }
            const pluginPath = join(marketplacePath, plugin.name);
            let versions: Dirent[] = [];
            try {
              versions = await readdir(pluginPath, { withFileTypes: true });
            } catch {
              return [] as string[];
            }
            const out: string[] = [];
            for (const version of versions) {
              if (!version.isDirectory()) {
                continue;
              }
              out.push(join(pluginPath, version.name, 'skills'));
            }
            return out;
          })
        );
        const flat: string[] = [];
        for (const list of inner) {
          for (const entry of list) {
            flat.push(entry);
          }
        }
        return flat;
      })
    );
    for (const list of versionDirLists) {
      for (const entry of list) {
        if (!activePaths.has(entry)) {
          staleVersions += 1;
        }
      }
    }

    return { dirs, staleVersions };
  } catch (error) {
    throw new SkilletError({
      message: 'failed to discover plugin skills',
      method: 'discoverPluginSkills',
      service: SERVICE,
      error
    });
  }
}
