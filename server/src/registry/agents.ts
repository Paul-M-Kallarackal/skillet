import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { SkilletError } from '../errors';
import type { SkilletConfig } from '../config/config.types';
import { AGENT_ROWS } from './agents.data';
import type { Agent, AgentDefinition, OverrideSource } from './agents.types';

const SERVICE = 'AgentRegistry';

const ENV_DEFAULTS: Record<string, string> = {
  HOME: homedir(),
  XDG_CONFIG_HOME: join(homedir(), '.config'),
  CLAUDE_CONFIG_DIR: join(homedir(), '.claude'),
  CODEX_HOME: join(homedir(), '.codex')
};

export function expandPath(raw: string): string {
  if (raw.length === 0) {
    return '';
  }
  let out = raw;
  const tokens = out.match(/\$[A-Z_]+/g);
  if (tokens) {
    for (const token of tokens) {
      const key = token.slice(1);
      let value = process.env[key];
      if (!value) {
        value = ENV_DEFAULTS[key];
      }
      if (!value) {
        return '';
      }
      out = out.split(token).join(value);
    }
  }
  if (out.startsWith('~')) {
    out = join(homedir(), out.slice(1));
  }
  return resolve(out);
}

function splitField(value: string): string[] {
  if (value.length === 0) {
    return [];
  }
  return value.split('|');
}

export function buildDefinitions(config: SkilletConfig): AgentDefinition[] {
  const definitions: AgentDefinition[] = [];
  for (const row of AGENT_ROWS) {
    let overrideSource: OverrideSource = 'none';
    if (row[5].length > 0) {
      overrideSource = row[5] as OverrideSource;
    }
    definitions.push({
      id: row[0],
      name: row[1],
      globalDir: row[2],
      projectDir: row[3],
      detect: splitField(row[4]),
      overrideSource,
      legacyGlobalDirs: splitField(row[6]),
      legacyProjectDirs: splitField(row[7])
    });
  }
  for (const custom of config.customAgents) {
    definitions.push(custom);
  }
  return definitions;
}

async function existsAny(paths: string[]): Promise<boolean> {
  if (paths.length === 0) {
    return false;
  }
  const checks = paths.map(async (path) => {
    if (path.length === 0) {
      return false;
    }
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  });
  const results = await Promise.all(checks);
  for (const result of results) {
    if (result) {
      return true;
    }
  }
  return false;
}

export async function resolveAgents(config: SkilletConfig): Promise<Agent[]> {
  try {
    const definitions = buildDefinitions(config);
    const customIds = new Set<string>();
    for (const custom of config.customAgents) {
      customIds.add(custom.id);
    }
    const detectPaths: string[][] = [];
    for (const definition of definitions) {
      const expanded: string[] = [];
      for (const entry of definition.detect) {
        const path = expandPath(entry);
        if (path.length > 0) {
          expanded.push(path);
        }
      }
      detectPaths.push(expanded);
    }
    const installedFlags = await Promise.all(detectPaths.map((paths) => existsAny(paths)));
    const agents: Agent[] = [];
    for (let index = 0; index < definitions.length; index += 1) {
      const definition = definitions[index];
      if (!definition) {
        continue;
      }
      const legacy: string[] = [];
      for (const entry of definition.legacyGlobalDirs) {
        const path = expandPath(entry);
        if (path.length > 0) {
          legacy.push(path);
        }
      }
      agents.push({
        ...definition,
        resolvedGlobalDir: expandPath(definition.globalDir),
        resolvedLegacyGlobalDirs: legacy,
        installed: installedFlags[index] === true,
        custom: customIds.has(definition.id)
      });
    }
    return agents;
  } catch (error) {
    throw new SkilletError({
      message: 'failed to resolve agent registry',
      method: 'resolveAgents',
      service: SERVICE,
      error
    });
  }
}

export function globalSkillDirs(agents: Agent[]): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();
  for (const agent of agents) {
    const candidates = [agent.resolvedGlobalDir, ...agent.resolvedLegacyGlobalDirs];
    for (const candidate of candidates) {
      if (candidate.length === 0) {
        continue;
      }
      if (seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      dirs.push(candidate);
    }
  }
  return dirs;
}

export function projectSkillDirNames(agents: Agent[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const agent of agents) {
    const candidates = [agent.projectDir, ...agent.legacyProjectDirs];
    for (const candidate of candidates) {
      if (candidate.length === 0) {
        continue;
      }
      if (seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      names.push(candidate);
    }
  }
  return names;
}

export function readersForGlobalDir(agents: Agent[], dir: string): string[] {
  const ids: string[] = [];
  for (const agent of agents) {
    if (agent.resolvedGlobalDir === dir) {
      ids.push(agent.id);
      continue;
    }
    if (agent.resolvedLegacyGlobalDirs.includes(dir)) {
      ids.push(agent.id);
    }
  }
  return ids;
}

export function readersForProjectDir(agents: Agent[], repoRoot: string, dir: string): string[] {
  const rel = relative(repoRoot, dir).split(sep).join('/');
  const ids: string[] = [];
  for (const agent of agents) {
    if (rel === agent.projectDir || rel.endsWith(`/${agent.projectDir}`)) {
      ids.push(agent.id);
      continue;
    }
    let matched = false;
    for (const legacy of agent.legacyProjectDirs) {
      if (rel === legacy || rel.endsWith(`/${legacy}`)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      ids.push(agent.id);
    }
  }
  return ids;
}
