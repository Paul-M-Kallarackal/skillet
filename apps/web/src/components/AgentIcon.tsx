import { Bot, Globe } from 'lucide-react';
import { additionalAgentLogos } from './agent-logo-map';
import '../styles/agent-icons.css';

const icons: Record<string, string> = {
  ...additionalAgentLogos,
  zed: 'zed', grok: 'grok',
  codex: 'openai', 'claude-code': 'claude', cursor: 'cursor', pi: 'pi', opencode: 'opencode',
  'gemini-cli': 'gemini', gemini: 'gemini', 'github-copilot': 'githubcopilot', copilot: 'githubcopilot', windsurf: 'windsurf', cline: 'cline'
};

export function AgentIcon({ id, name, decorative = false }: { id: string; name: string; decorative?: boolean }) {
  const icon = icons[id];
  return <span className={`agent-icon${id === 'codex' ? ' agent-icon-codex' : ''}`} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : name} aria-hidden={decorative || undefined}>
    {icon ? <span className="agent-icon-art" style={{ maskImage: `url(/agent-icons/${icon}.svg)`, WebkitMaskImage: `url(/agent-icons/${icon}.svg)` }} /> : id === 'universal' ? <Globe size={18} aria-hidden="true" /> : <Bot size={18} aria-hidden="true" />}
  </span>;
}

export function AgentBadge({ id, name }: { id: string; name: string }) {
  return <span className="agent-badge" title={name}><AgentIcon id={id} name={name} /><span className="agent-tooltip" aria-hidden="true">{name}</span></span>;
}
