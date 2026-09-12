import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { readOpenCodePolicy } from './opencode-policy';
import { SkilletError } from '../errors';
import { expandPath } from '../registry/agents';
import type { Repo } from './git.types';
import type { OverrideState } from './overrides.types';

const SERVICE = 'OverrideService';

async function readSkillOverrides(dir: string, project = false): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const files = project ? [join(dir, 'settings.local.json'), join(dir, 'settings.json')] : [join(dir, 'settings.json')];
  const texts = await Promise.all(
    files.map(async (file) => {
      try {
        return await readFile(file, 'utf8');
      } catch {
        return '';
      }
    })
  );
  for (const text of texts) {
    if (text.length === 0) {
      continue;
    }
    let parsed: { skillOverrides?: Record<string, string> } = {};
    try {
      parsed = JSON.parse(text) as { skillOverrides?: Record<string, string> };
    } catch {
      continue;
    }
    const overrides = parsed.skillOverrides;
    if (!overrides) {
      continue;
    }
    for (const [name, state] of Object.entries(overrides)) {
      if (!(name in map)) {
        map[name] = state;
      }
    }
  }
  return map;
}

export async function readOverrideState(repos: Repo[]): Promise<OverrideState> {
  try {
    const claudeHome = expandPath('$CLAUDE_CONFIG_DIR');
    const codexHome = expandPath('$CODEX_HOME');
    const globalPromise = readSkillOverrides(claudeHome);
    const repoPromises = repos.map((repo) => readSkillOverrides(join(repo.gitRoot, '.claude'), true));
    const codexPromise = readFile(join(codexHome, 'config.toml'), 'utf8').catch(() => '');
    const [claudeGlobal, repoMaps, codexText] = await Promise.all([
      globalPromise,
      Promise.all(repoPromises),
      codexPromise
    ]);

    const claudeByRepo: Record<string, Record<string, string>> = {};
    for (let index = 0; index < repos.length; index += 1) {
      const repo = repos[index];
      const map = repoMaps[index];
      if (!repo || !map) {
        continue;
      }
      if (Object.keys(map).length > 0) {
        claudeByRepo[repo.id] = map;
      }
    }

    const codexDisabled: string[] = [];
    let codexError = false;
    if (codexText.length > 0) {
      try {
        const parsed = parseToml(codexText) as { skills?: { config?: { path?: string; enabled?: boolean }[] } };
        const entries = parsed.skills?.config ?? [];
        if (!Array.isArray(entries)) { throw new Error('Invalid skills.config'); }
        const byPath = new Map<string, boolean>();
        for (const entry of entries) {
          if (typeof entry.path === 'string') {
            byPath.set(expandPath(entry.path), entry.enabled !== false);
          }
        }
        for (const [path, enabled] of byPath) {
          if (!enabled) { codexDisabled.push(path); }
        }
      } catch {
        codexError = true;
      }
    }
    const [openCodeGlobal, projectPolicies] = await Promise.all([
      readOpenCodePolicy(), Promise.all(repos.map((repo) => readOpenCodePolicy(repo.gitRoot)))
    ]);
    const openCodeByRepo = Object.fromEntries(repos.map((repo, index) => [repo.id, projectPolicies[index] ?? { rules: {}, uncertain: true }]));
    return { claudeGlobal, claudeByRepo, codexDisabled, codexError, openCodeGlobal, openCodeByRepo };

  } catch (error) {
    throw new SkilletError({
      message: 'failed to read override state',
      method: 'readOverrideState',
      service: SERVICE,
      error
    });
  }
}
