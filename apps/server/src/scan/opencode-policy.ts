import { join } from 'node:path';
import { parseSettings, readOptional, record } from '../hub/agent-settings';
import { expandPath } from '../registry/agents';

export interface OpenCodePolicy {
  rules: Record<string, string>;
  uncertain: boolean;
}

export async function readOpenCodePolicy(repoRoot = ''): Promise<OpenCodePolicy> {
  let base = expandPath('$XDG_CONFIG_HOME/opencode');
  if (repoRoot) {
    base = repoRoot;
  }
  const result: OpenCodePolicy = { rules: {}, uncertain: Boolean(process.env.OPENCODE_CONFIG || process.env.OPENCODE_CONFIG_CONTENT || process.env.OPENCODE_CONFIG_DIR) };
  for (const file of ['opencode.json', 'opencode.jsonc']) {
    try {
      const text = await readOptional(join(base, file));
      if (text === null) {
        continue;
      }
      const data = parseSettings(text, 'jsonc');
      if (data.permissions || data.agent || data.skills || data.tools || process.env.OPENCODE_CONFIG || process.env.OPENCODE_CONFIG_CONTENT) {
        result.uncertain = true;
      }
      let permission = data.permission;
      if (permission && typeof permission === 'object') {
        const p = record(permission);
        permission = p.skill ?? p['*'];
      }
      if (typeof permission === 'string') {
        result.rules = { '*': permission };
      } else if (permission && typeof permission === 'object') {
        for (const [pattern, value] of Object.entries(record(permission))) {
          if (typeof value === 'string') {
            delete result.rules[pattern];
            result.rules[pattern] = value;
          }
        }
      }
    } catch {
      result.uncertain = true;
    }
  }
  return result;
}

export function openCodeAccess(name: string, global: OpenCodePolicy | undefined, project: OpenCodePolicy | undefined): 'auto' | 'ask' | 'off' | 'unknown' {
  if (global?.uncertain || project?.uncertain) {
    return 'unknown';
  }
  let result: 'auto' | 'ask' | 'off' | 'unknown' = 'auto';
  for (const source of [global, project]) {
    for (const [pattern, permission] of Object.entries(source?.rules ?? {})) {
      const expression = pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
      if (!new RegExp(`^${expression}$`).test(name)) {
        continue;
      }
      if (permission === 'deny') { result = 'off'; }
      else if (permission === 'ask') { result = 'ask'; }
      else if (permission === 'allow') { result = 'auto'; }
      else { result = 'unknown'; }
    }
  }
  return result;
}
