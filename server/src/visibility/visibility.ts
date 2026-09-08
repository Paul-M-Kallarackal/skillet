import { basename } from 'node:path';
import type { Agent } from '../registry/agents.types';
import type { Repo } from '../scan/git.types';
import type { Skill } from '../scan/index.types';
import type { OverrideState } from '../scan/overrides.types';
import type { SkillInstance } from '../scan/walk.types';
import type { CellState, VisibilityCell } from './visibility.types';

function instanceForAgent(skill: Skill, agentId: string): SkillInstance | null {
  for (const instance of skill.instances) {
    if (instance.readers.includes(agentId)) {
      return instance;
    }
  }
  return null;
}

function claudeOverrideState(raw: string): CellState {
  if (raw === 'off') {
    return 'off';
  }
  if (raw === 'name-only') {
    return 'name-only';
  }
  if (raw === 'user-invocable-only') {
    return 'user-only';
  }
  return 'auto';
}

function scopeConditions(instance: SkillInstance, repos: Repo[]): string[] {
  const conditions: string[] = [];
  if (instance.scope === 'project') {
    let repoLabel = basename(instance.repoId);
    for (const repo of repos) {
      if (repo.id !== instance.repoId) {
        continue;
      }
      repoLabel = repo.label;
    }
    conditions.push(`cwd inside ${repoLabel}`);
    if (instance.nestedDir.length > 0) {
      conditions.push(`editing under ${instance.nestedDir}/`);
    }
  }
  if (instance.scope === 'plugin') {
    conditions.push(`plugin ${instance.pluginName} enabled`);
  }
  if (instance.frontmatter.paths.length > 0) {
    conditions.push(`editing ${instance.frontmatter.paths.join(' or ')}`);
  }
  return conditions;
}

function legacyCondition(agent: Agent, instance: SkillInstance): string {
  if (instance.scope === 'global') {
    if (agent.resolvedLegacyGlobalDirs.includes(instance.parentDir)) {
      return `via compat dir ${instance.parentDir}`;
    }
    return '';
  }
  for (const legacy of agent.legacyProjectDirs) {
    if (instance.parentDir.endsWith(`/${legacy}`)) {
      return `via compat dir ${legacy}`;
    }
  }
  return '';
}

export function computeCells(
  skill: Skill,
  agents: Agent[],
  repos: Repo[],
  overrides: OverrideState,
  showAll: boolean
): VisibilityCell[] {
  const cells: VisibilityCell[] = [];
  for (const agent of agents) {
    if (!agent.installed && !agent.custom && !showAll) {
      continue;
    }
    if (!agent.installed && !agent.custom) {
      cells.push({
        agentId: agent.id,
        agentName: agent.name,
        state: 'n-a',
        conditions: ['agent not installed'],
        instanceId: ''
      });
      continue;
    }

    const instance = instanceForAgent(skill, agent.id);
    if (!instance) {
      cells.push({
        agentId: agent.id,
        agentName: agent.name,
        state: 'not-linked',
        conditions: [],
        instanceId: ''
      });
      continue;
    }

    let state: CellState = 'auto';
    const conditions = scopeConditions(instance, repos);

    if (agent.overrideSource === 'claude') {
      let raw = '';
      const globalValue = overrides.claudeGlobal[skill.name];
      if (globalValue) {
        raw = globalValue;
      }
      if (raw.length === 0) {
        const repoMap = overrides.claudeByRepo[instance.repoId];
        if (repoMap) {
          const repoValue = repoMap[skill.name];
          if (repoValue) {
            raw = repoValue;
          }
        }
      }
      if (raw.length > 0) {
        state = claudeOverrideState(raw);
        conditions.push(`skillOverrides: ${raw}`);
      }
      if (skill.shadowed) {
        conditions.push('shadowed by a global skill of the same name');
      }
    }

    if (agent.overrideSource === 'codex' && overrides.codexDisabled.includes(skill.name)) {
      state = 'off';
      conditions.push('disabled in ~/.codex/config.toml');
    }

    if (state === 'auto' && instance.frontmatter.disableModelInvocation) {
      state = 'user-only';
      conditions.push('disable-model-invocation: true');
    }
    if (state === 'auto' && !instance.frontmatter.userInvocable) {
      state = 'model-only';
      conditions.push('user-invocable: false');
    }

    const legacy = legacyCondition(agent, instance);
    if (legacy.length > 0) {
      conditions.push(legacy);
    }
    if (instance.kind === 'symlink') {
      conditions.push(`symlink to ${instance.symlinkTarget}`);
    }

    cells.push({ agentId: agent.id, agentName: agent.name, state, conditions, instanceId: instance.id });
  }
  return cells;
}
