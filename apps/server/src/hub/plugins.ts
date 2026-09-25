import { join, resolve, sep } from 'node:path';
import { TRASH_PATH } from '../config/config.constants';
import { SkilletError } from '../errors';
import { expandPath } from '../registry/agents';
import { claudePluginsRoot } from '../scan/plugins';
import { getIndex } from '../scan/scanner';
import { configSteps, parseSettings, record } from './agent-settings';
import { appendEntry } from './journal';
import { applySteps, step, writeStep } from './steps';
import type { FsStep, OpResult } from './steps.types';
import { manifestPath } from './trash';
import type { TrashEntry } from './trash';

const SERVICE = 'PluginActions';
const PLUGIN_KEY = /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$/;

export interface UninstallPreview {
  key: string;
  command: string[];
  skillCount: number;
  applied: boolean;
  output: string;
}

function pluginError(message: string, status: number): SkilletError {
  return new SkilletError({ message, method: 'plugin', service: SERVICE, error: null, status });
}

function requirePlugin(key: string) {
  if (!PLUGIN_KEY.test(key)) {
    throw pluginError('Unknown plugin id.', 400);
  }
  for (const plugin of getIndex().plugins) {
    if (plugin.key === key) {
      return plugin;
    }
  }
  throw pluginError(`Plugin ${key} is not installed.`, 404);
}

/** Turns a plugin on or off in ~/.claude/settings.json; reversible through the journal. */
export async function setPluginEnabled(input: { key: string; enabled: boolean; dryRun: boolean }): Promise<OpResult> {
  try {
    requirePlugin(input.key);
    const file = join(expandPath('$CLAUDE_CONFIG_DIR'), 'settings.json');
    const { steps, inverse } = await configSteps(file, (text) => {
      const data = parseSettings(text, 'jsonc');
      const enabledPlugins = record(data.enabledPlugins ?? {});
      enabledPlugins[input.key] = input.enabled;
      return `${JSON.stringify({ ...data, enabledPlugins }, null, 2)}\n`;
    });
    if (input.dryRun || steps.length === 0) {
      return { steps, applied: false, journalId: '' };
    }
    await applySteps(steps);
    let action = 'plugin-disable';
    if (input.enabled) {
      action = 'plugin-enable';
    }
    const entry = await appendEntry({ action, skillId: input.key, steps }, inverse);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'changing the plugin failed', method: 'setPluginEnabled', service: SERVICE, error });
  }
}

/** Uninstalls through Claude Code's own CLI so its plugin records stay consistent. Not reversible. */
export async function uninstallPlugin(input: { key: string; dryRun: boolean }): Promise<UninstallPreview> {
  try {
    const plugin = requirePlugin(input.key);
    const command = ['claude', 'plugin', 'uninstall', input.key, '--json'];
    const preview: UninstallPreview = { key: input.key, command, skillCount: plugin.skillNames.length, applied: false, output: '' };
    if (input.dryRun) {
      return preview;
    }
    const binary = Bun.which('claude') ?? Bun.which('claude', { PATH: `${process.env.PATH ?? ''}:${expandPath('~/.local/bin')}:/opt/homebrew/bin:/usr/local/bin` });
    if (!binary) {
      throw pluginError('Claude Code CLI not found on PATH. Run the command above in a terminal instead.', 400);
    }
    const child = Bun.spawn([binary, ...command.slice(1)], { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) {
      throw pluginError(`claude plugin uninstall failed: ${(stderr || stdout).trim()}`, 500);
    }
    return { ...preview, applied: true, output: stdout.trim() };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'uninstall failed', method: 'uninstallPlugin', service: SERVICE, error });
  }
}

/** Moves plugin cache versions no installed plugin uses into Skillet's Trash, one restorable entry each. */
export async function cleanStaleCaches(input: { dryRun: boolean }): Promise<OpResult> {
  try {
    const cacheRoot = resolve(claudePluginsRoot(), 'cache') + sep;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const steps: FsStep[] = [];
    const inverse: FsStep[] = [];
    for (const cache of getIndex().staleCaches) {
      const origin = resolve(cache.path);
      if (!origin.startsWith(cacheRoot)) {
        throw pluginError(`Refusing to move ${origin}: not inside the Claude plugin cache.`, 400);
      }
      const entryId = `${stamp}-${cache.plugin}-${cache.version}`;
      const entryDir = join(TRASH_PATH, entryId);
      const trashPath = join(entryDir, `${cache.plugin}-${cache.version}`);
      const manifest: TrashEntry = { id: entryId, name: `${cache.plugin} ${cache.version} (plugin cache)`, trashedAt: new Date().toISOString(), originPath: origin, trashPath, removedLinks: [] };
      steps.push(step('mkdir', '', entryDir, `create trash entry ${entryId}`));
      steps.push(writeStep(manifestPath(entryId), `${JSON.stringify(manifest, null, 2)}\n`, 'write trash manifest first'));
      steps.push(step('move', origin, trashPath, `move old ${cache.plugin} ${cache.version} to trash`));
      inverse.push(step('move', trashPath, origin, `restore ${cache.plugin} ${cache.version}`));
    }
    if (input.dryRun || steps.length === 0) {
      return { steps, applied: false, journalId: '' };
    }
    await applySteps(steps);
    const entry = await appendEntry({ action: 'plugin-cache-clean', skillId: '', steps }, inverse);
    return { steps, applied: true, journalId: entry.id };
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({ message: 'cleaning plugin caches failed', method: 'cleanStaleCaches', service: SERVICE, error });
  }
}
