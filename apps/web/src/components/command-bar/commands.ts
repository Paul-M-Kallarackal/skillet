import { api } from '../../api/client';
import type { LinkTarget, SkilletIndex } from '../../api/client.types';
import type { CommandDefinition, MenuOption, PickedValue, StepKind } from './command-bar.types';
import { isLinkedCell, isMainCheckoutWithSkills } from '../shell/skill-visibility';
import { skillCountByRepo } from '../shell/sidebar-state';

const GLOBAL_DESTINATION = '';

function idAt(values: PickedValue[], position: number): string {
  return values[position]?.id ?? '';
}

function targetFor(index: SkilletIndex, skillId: string, agentId: string, destination: string): LinkTarget {
  if (destination.length > 0) {
    return { agentId, scope: 'project', repoId: destination };
  }
  for (const skill of index.skills) {
    if (skill.id === skillId && skill.scope === 'project') {
      return { agentId, scope: 'project', repoId: skill.repoId };
    }
  }
  return { agentId, scope: 'global', repoId: '' };
}

export function buildCommands(index: SkilletIndex): CommandDefinition[] {
  return [
    {
      id: 'link', summary: 'make a skill visible to an agent',
      steps: [{ kind: 'skill', prompt: 'Search skills', title: 'Pick a skill' }, { kind: 'agent', prompt: 'Search agents', title: 'Link to agent', connector: 'to' }],
      mutate: (values, dryRun) => api.link(idAt(values, 0), { target: targetFor(index, idAt(values, 0), idAt(values, 1), GLOBAL_DESTINATION), dryRun })
    },
    {
      id: 'copy', summary: 'copy a skill to an agent or project',
      steps: [{ kind: 'skill', prompt: 'Search skills', title: 'Pick a skill' }, { kind: 'agent', prompt: 'Search agents', title: 'Copy for agent', connector: 'for' }, { kind: 'destination', prompt: 'Global or a project', title: 'Copy into', connector: 'into' }],
      mutate: (values, dryRun) => api.copy(idAt(values, 0), { target: targetFor(index, idAt(values, 0), idAt(values, 1), idAt(values, 2)), mode: 'copy', dryRun })
    },
    {
      id: 'move', summary: 'move a skill to an agent or project',
      steps: [{ kind: 'skill', prompt: 'Search skills', title: 'Pick a skill' }, { kind: 'agent', prompt: 'Search agents', title: 'Move for agent', connector: 'for' }, { kind: 'destination', prompt: 'Global or a project', title: 'Move into', connector: 'into' }],
      mutate: (values, dryRun) => api.move(idAt(values, 0), { target: targetFor(index, idAt(values, 0), idAt(values, 1), idAt(values, 2)), keepLinkAtSource: false, dryRun })
    },
    {
      id: 'rename', summary: 'rename a skill',
      steps: [{ kind: 'skill', prompt: 'Search skills', title: 'Pick a skill' }, { kind: 'text', prompt: 'New name, lowercase-with-hyphens', title: 'New name', connector: 'as' }],
      mutate: (values, dryRun) => api.rename(idAt(values, 0), { newName: idAt(values, 1), dryRun })
    },
    {
      id: 'trash', summary: 'move a skill to the trash',
      steps: [{ kind: 'skill', prompt: 'Search skills', title: 'Move to trash' }],
      mutate: (values, dryRun) => api.trash(idAt(values, 0), { dryRun })
    },
    {
      id: 'undo', summary: 'undo the last change', steps: [],
      act: async (_values, context) => {
        try {
          const result = await api.undo();
          context.refresh();
          return `Undid ${result.entry.id}`;
        } catch (error) {
          throw new Error(`undo failed: ${String(error)}`);
        }
      }
    },
    { id: 'agent', summary: 'show skills an agent can read', steps: [{ kind: 'agent', prompt: 'Search agents', title: 'Show skills for agent' }], act: (values, context) => { context.navigate(`/skills?agent=${encodeURIComponent(idAt(values, 0))}`); return Promise.resolve(''); } },
    { id: 'repo', summary: 'show skills in a project', steps: [{ kind: 'project', prompt: 'Search projects', title: 'Show skills in project' }], act: (values, context) => { context.navigate(`/skills?repo=${encodeURIComponent(idAt(values, 0))}`); return Promise.resolve(''); } },
    {
      id: 'rescan', summary: 'scan the machine again', steps: [],
      act: async (_values, context) => {
        try {
          await api.rescan();
          context.refresh();
          return 'Rescanned';
        } catch (error) {
          throw new Error(`rescan failed: ${String(error)}`);
        }
      }
    },
    { id: 'adopt', summary: 'open Adopt into hub', steps: [], act: (_values, context) => { context.navigate('/adopt'); return Promise.resolve(''); } },
    { id: 'agents', summary: 'open All agents', steps: [], act: (_values, context) => { context.navigate('/agents'); return Promise.resolve(''); } },
    { id: 'trash-bin', summary: 'open Trash', steps: [], act: (_values, context) => { context.navigate('/trash'); return Promise.resolve(''); } },
    { id: 'settings', summary: 'open Settings', steps: [], act: (_values, context) => { context.navigate('/settings'); return Promise.resolve(''); } }
  ];
}

function includesNeedle(text: string, needle: string): boolean {
  return needle.length === 0 || text.toLowerCase().includes(needle);
}

export function optionsFor(kind: StepKind, index: SkilletIndex, needle: string, picked: PickedValue[]): MenuOption[] {
  const options: MenuOption[] = [];
  if (kind === 'skill') {
    for (const skill of index.skills) {
      if (includesNeedle(`${skill.name} ${skill.description}`, needle)) {
        options.push({ id: skill.id, label: skill.name, meta: skill.scope, icon: 'none' });
      }
    }
  }
  if (kind === 'agent') {
    let linked = new Set<string>();
    const skillId = idAt(picked, 0);
    if (skillId.length > 0) {
      linked = linkedAgents(index, skillId);
    }
    const ready: MenuOption[] = [];
    const alreadyLinked: MenuOption[] = [];
    const notDetected: MenuOption[] = [];
    for (const agent of index.agents) {
      if (!includesNeedle(agent.name, needle)) {
        continue;
      }
      if (!agent.installed && !index.showAllAgents) {
        continue;
      }
      if (!agent.installed) {
        notDetected.push({ id: agent.id, label: agent.name, meta: 'Not detected', icon: 'agent' });
      } else if (linked.has(agent.id)) {
        alreadyLinked.push({ id: agent.id, label: agent.name, meta: 'Already linked', icon: 'agent' });
      } else {
        ready.push({ id: agent.id, label: agent.name, meta: 'Detected', icon: 'agent' });
      }
    }
    options.push(...ready, ...alreadyLinked, ...notDetected);
  }
  if (kind === 'project') {
    const counts = skillCountByRepo(index.skills);
    for (const repo of index.repos) {
      const count = counts.get(repo.id) ?? 0;
      if (isMainCheckoutWithSkills(repo, counts) && includesNeedle(repo.label, needle)) {
        let meta = `${count} skills`;
        if (count === 1) {
          meta = '1 skill';
        }
        options.push({ id: repo.id, label: repo.label, meta, icon: 'folder' });
      }
    }
  }
  if (kind === 'destination') {
    if (includesNeedle('global', needle)) {
      options.push({ id: GLOBAL_DESTINATION, label: 'Global', meta: 'Every project', icon: 'folder' });
    }
    for (const repo of index.repos) {
      if (!repo.isWorktree && includesNeedle(repo.label, needle)) {
        options.push({ id: repo.id, label: repo.label, meta: repo.branch, icon: 'folder' });
      }
    }
  }
  return options;
}

function linkedAgents(index: SkilletIndex, skillId: string): Set<string> {
  const linked = new Set<string>();
  const cells = index.cells[skillId] ?? [];
  for (const cell of cells) {
    if (isLinkedCell(cell)) {
      linked.add(cell.agentId);
    }
  }
  return linked;
}
