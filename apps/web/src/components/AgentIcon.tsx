import { Bot, Globe } from 'lucide-react';
import { additionalAgentLogos } from './agent-logo-map';
import '../styles/agent-icons.css';

const icons: Record<string, string> = {
  ...additionalAgentLogos,
  zed: 'zed', grok: 'grok',
  codex: 'openai', 'claude-code': 'claudecode', cursor: 'cursor', pi: 'pi', opencode: 'opencode',
  'gemini-cli': 'gemini', gemini: 'gemini', 'github-copilot': 'githubcopilot', copilot: 'githubcopilot', windsurf: 'windsurf', cline: 'cline'
};

export function AgentIcon({ id, name, decorative = false }: { id: string; name: string; decorative?: boolean }) {
  const icon = icons[id];
  let className = 'agent-icon';
  if (id === 'codex') {
    className += ' agent-icon-codex';
  }
  let art = <Bot size={18} aria-hidden="true" />;
  if (icon) {
    art = <span className="agent-icon-art" style={{ maskImage: `url(/agent-icons/${icon}.svg)`, WebkitMaskImage: `url(/agent-icons/${icon}.svg)` }} />;
  } else if (id === 'universal') {
    art = <Globe size={18} aria-hidden="true" />;
  }
  if (decorative) {
    return <span data-agent={id} className={className} aria-hidden="true">{art}</span>;
  }
  return <span data-agent={id} className={className} role="img" aria-label={name}>{art}</span>;
}

