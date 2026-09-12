const common = new Set(['codex', 'claude-code', 'cursor', 'grok', 'zed', 'gemini-cli', 'github-copilot', 'opencode', 'pi', 'windsurf', 'cline']);
export function isCommonAgent(id: string): boolean { return common.has(id); }
