import type { Skill, VisibilityCell } from '../api/client.types';

export function canAgentReadSkill(instances: Skill['instances'], cells: VisibilityCell[], agentId: string): boolean {
  return instances.some((instance) => {
    const policies = cells.filter((cell) => cell.agentId === agentId && cell.instanceId === instance.id);
    // An explicit policy takes precedence over the agent's directory membership.
    if (policies.length > 0) {
      return policies.some((cell) => !['off', 'not-linked', 'n-a'].includes(cell.state));
    }
    return instance.readers?.includes(agentId) ?? false;
  });
}
