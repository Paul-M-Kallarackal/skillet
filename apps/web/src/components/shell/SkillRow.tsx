import { Eye, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Agent, Skill, VisibilityCell } from '../../api/client.types';
import { AgentIcon } from '../AgentIcon';
import { IconButton } from '../IconButton';
import { ShareSkillButton } from '../ShareSkillButton';
import { presentSkill } from '../skill-presentation';
import { isLinkedCell, SCOPE_LABELS } from './skill-visibility';

const MAX_BADGES = 3;

function readersOf(skill: Skill, agents: Agent[], cells: VisibilityCell[]): Agent[] {
  const visible = new Set<string>();
  for (const instance of skill.instances) {
    for (const reader of instance.readers ?? []) {
      visible.add(reader);
    }
  }
  for (const cell of cells) {
    if (isLinkedCell(cell)) {
      visible.add(cell.agentId);
    }
  }
  const readers: Agent[] = [];
  for (const agent of agents) {
    if (visible.has(agent.id)) {
      readers.push(agent);
    }
  }
  return readers;
}

/** Wraps each case-insensitive match of `needle` in <mark> so search results show why they matched. */
function highlightText(text: string, needle: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const query = needle.trim().toLowerCase();
  if (query.length === 0) {
    parts.push(text);
    return parts;
  }
  const lower = text.toLowerCase();
  let cursor = 0;
  let found = lower.indexOf(query, cursor);
  while (found >= 0) {
    if (found > cursor) {
      parts.push(text.slice(cursor, found));
    }
    parts.push(<mark className="shell-mark" key={`${found}-${query}`}>{text.slice(found, found + query.length)}</mark>);
    cursor = found + query.length;
    found = lower.indexOf(query, cursor);
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}

export function SkillRow({ skill, agents, cells, highlight, onManage, onTrash }: { skill: Skill; agents: Agent[]; cells: VisibilityCell[]; highlight: string; onManage: () => void; onTrash: () => void }) {
  const presentation = presentSkill(skill);
  const readers = readersOf(skill, agents, cells);
  const badges: Agent[] = [];
  const hiddenNames: string[] = [];
  for (const agent of readers) {
    if (badges.length < MAX_BADGES) {
      badges.push(agent);
    } else {
      hiddenNames.push(agent.name);
    }
  }
  let summary = presentation.summary;
  if (summary.length === 0) {
    summary = skill.description;
  }
  return (
    <div className="shell-skill-row">
      <Link className="shell-skill-copy" to={`/skills/${encodeURIComponent(skill.id)}`}>
        <span className="shell-skill-name">{highlightText(skill.name, highlight)}</span>
        <span className="shell-skill-summary">{highlightText(summary, highlight)}</span>
      </Link>
      <span className="shell-skill-actions">
        <ShareSkillButton skill={skill} />
        <IconButton label="Manage visibility" onClick={onManage}><Eye aria-hidden="true" /></IconButton>
        {skill.scope !== 'plugin' && <IconButton label="Move to trash" onClick={onTrash}><Trash2 aria-hidden="true" /></IconButton>}
      </span>
      <span className="shell-skill-agents" role="group" aria-label={`Agent access for ${skill.name}`}>
        {badges.map((agent) => <span className="shell-agent-badge" title={agent.name} key={agent.id}><AgentIcon id={agent.id} name={agent.name} /></span>)}
        {hiddenNames.length > 0 && <span className="shell-agent-badge is-overflow" title={hiddenNames.join(', ')}>{`+${hiddenNames.length}`}</span>}
      </span>
      <span className="shell-skill-scope">{SCOPE_LABELS[skill.scope] ?? skill.scope}</span>
    </div>
  );
}
