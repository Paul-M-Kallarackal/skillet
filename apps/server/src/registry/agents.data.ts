export type AgentRow = [string, string, string, string, string, string, string, string];

export const AGENT_ROWS: AgentRow[] = [
  ['claude-code', 'Claude Code', '$CLAUDE_CONFIG_DIR/skills', '.claude/skills', '$CLAUDE_CONFIG_DIR', 'claude', '', ''],
  ['codex', 'Codex', '$CODEX_HOME/skills', '.agents/skills', '$CODEX_HOME', 'codex', '$HOME/.agents/skills', '.codex/skills'],
  ['cursor', 'Cursor', '$HOME/.cursor/skills', '.agents/skills', '$HOME/.cursor', '', '$HOME/.agents/skills|$HOME/.claude/skills|$HOME/.codex/skills', '.cursor/skills|.claude/skills|.codex/skills'],
  ['opencode', 'OpenCode', '$XDG_CONFIG_HOME/opencode/skills', '.opencode/skills', '$XDG_CONFIG_HOME/opencode', '', '$HOME/.claude/skills|$HOME/.agents/skills', '.agents/skills|.claude/skills'],
  ['pi', 'Pi', '$HOME/.pi/agent/skills', '.pi/skills', '$HOME/.pi/agent', '', '$HOME/.agents/skills', '.agents/skills'],
];
