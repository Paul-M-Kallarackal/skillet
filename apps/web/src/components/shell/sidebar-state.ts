import type { Agent, Repo, Skill } from '../../api/client.types';
import { isMainCheckoutWithSkills } from './skill-visibility';

export const DEFAULT_VISIBLE_PROJECTS = 8;
export const DEFAULT_VISIBLE_AGENTS = 6;

export function pickById<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const wanted = new Set(ids);
  const picked: T[] = [];
  for (const item of items) {
    if (wanted.has(item.id)) {
      picked.push(item);
    }
  }
  return picked;
}

export function idsOf<T extends { id: string }>(items: T[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(item.id);
  }
  return ids;
}

export function withoutId(ids: string[], removed: string): string[] {
  const remaining: string[] = [];
  for (const id of ids) {
    if (id !== removed) {
      remaining.push(id);
    }
  }
  return remaining;
}

/** Agents offered in the shell: detected ones, or every known agent when the owner opted in. */
export function detectedAgents(agents: Agent[], showAll: boolean): Agent[] {
  const detected: Agent[] = [];
  for (const agent of agents) {
    if (showAll || agent.installed) {
      detected.push(agent);
    }
  }
  return detected;
}

export function skillCountByRepo(skills: Skill[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const skill of skills) {
    if (skill.repoId.length > 0) {
      counts.set(skill.repoId, (counts.get(skill.repoId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Default Projects: main checkouts with at least one skill, most skills first. */
export function defaultRepos(repos: Repo[], counts: Map<string, number>): Repo[] {
  const withSkills: Repo[] = [];
  for (const repo of repos) {
    if (isMainCheckoutWithSkills(repo, counts)) {
      withSkills.push(repo);
    }
  }
  withSkills.sort((left, right) => (counts.get(right.id) ?? 0) - (counts.get(left.id) ?? 0));
  return withSkills;
}
