import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Agent } from '../../api/client.types';
import { AgentIcon } from '../AgentIcon';
import { IconButton } from '../IconButton';
import { SidebarRow } from './SidebarRow';
import { SidebarSection } from './SidebarSection';
import { DEFAULT_VISIBLE_AGENTS, withoutId, idsOf } from './sidebar-state';

export function SidebarAgents({ agents, activeAgent, onHide, onEdit, onNavigate }: { agents: Agent[]; activeAgent: string; onHide: (ids: string[]) => void; onEdit: () => void; onNavigate: () => void }) {
  const shownIds = idsOf(agents);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(false);
  const needle = filter.trim().toLowerCase();
  const matching: Agent[] = [];
  for (const agent of agents) {
    if (needle.length === 0 || agent.name.toLowerCase().includes(needle)) {
      matching.push(agent);
    }
  }
  // Long lists fold after six rows so Projects stays on screen; filtering always shows every match.
  const visible: Agent[] = [];
  for (const agent of matching) {
    if (needle.length > 0 || expanded || visible.length < DEFAULT_VISIBLE_AGENTS) {
      visible.push(agent);
    }
  }
  let moreLabel = '';
  if (expanded && matching.length > DEFAULT_VISIBLE_AGENTS) {
    moreLabel = 'Show less';
  } else if (matching.length > visible.length) {
    moreLabel = `${matching.length - visible.length} more · Show all`;
  }
  return (
    <SidebarSection title="Agents" storageKey="skillet.sidebar.agents.collapsed" filter={{ value: filter, onChange: setFilter, placeholder: 'Filter agents' }} actions={<IconButton label="Choose agents" onClick={onEdit}><Plus aria-hidden="true" /></IconButton>}>
      {visible.map((agent) => {
        let dot = null;
        if (agent.installed) {
          dot = <span className="shell-dot" role="img" aria-label="Detected" />;
        }
        return (
          <SidebarRow key={agent.id} className="agent-filter" icon={<AgentIcon id={agent.id} name={agent.name} decorative />} label={agent.name} to={`/skills?agent=${encodeURIComponent(agent.id)}`} selected={activeAgent === agent.id} trailing={dot} title={agent.name} onClick={onNavigate} onHide={() => onHide(withoutId(shownIds, agent.id))} />
        );
      })}
      {agents.length === 0 && <SidebarRow icon={<Plus />} label="Choose agents" muted onClick={onEdit} />}
      {moreLabel.length > 0 && <button type="button" className="shell-row-more" onClick={() => setExpanded(!expanded)}>{moreLabel}</button>}
    </SidebarSection>
  );
}
