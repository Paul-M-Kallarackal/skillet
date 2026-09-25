import type { Repo, VisibilityCell } from '../../api/client.types';

const UNLINKED_CELL_STATES = ['not-linked', 'n-a', 'off'];

export const SCOPE_LABELS: Record<string, string> = { global: 'Global', project: 'Project', plugin: 'Plugin' };

/** A visibility cell means the agent can read the skill unless it is unlinked, not applicable or switched off. */
export function isLinkedCell(cell: VisibilityCell): boolean {
  return !UNLINKED_CELL_STATES.includes(cell.state);
}

/** Projects shown by default: main checkouts that hold at least one skill. */
export function isMainCheckoutWithSkills(repo: Repo, counts: Map<string, number>): boolean {
  return !repo.isWorktree && (counts.get(repo.id) ?? 0) > 0;
}
