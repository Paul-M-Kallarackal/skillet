export function supportsExplicitOnly(agentId: string): boolean {
  return ['claude-code', 'pi', 'cursor'].includes(agentId);
}

export function supportsSkillPaths(agentId: string): boolean {
  return ['claude-code', 'cursor'].includes(agentId);
}

export function hasVerifiedPolicy(agentId: string): boolean {
  return ['claude-code', 'codex', 'pi', 'opencode', 'cursor'].includes(agentId);
}
