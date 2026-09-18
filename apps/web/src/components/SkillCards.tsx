import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Globe } from 'lucide-react';
import { AgentBadge } from './AgentIcon';
import { ShareSkillButton } from './ShareSkillButton';
import { IconButton } from './IconButton';
import { Dialog } from './Dialog';
import { SkillSharingActions } from './SkillSharingActions';
import { presentSkill } from './skill-presentation';
import { canAgentReadSkill } from './skill-access';
import type { Agent, Skill, VisibilityCell } from '../api/client.types';

export function SkillCards({ skills, cells, agents, emptyMessage = 'No skills match this view.' }: { skills: Skill[]; cells: Record<string, VisibilityCell[]>; agents: Agent[]; emptyMessage?: string | undefined }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = skills.find((skill) => skill.id === selectedId);
  if (skills.length === 0) return <div className="empty-state" role="status">{emptyMessage}</div>;
  return (
    <>
      <div className="skill-inventory">
        {skills.map((skill) => {
          const canonical = skill.instances.find((instance) => instance.id === skill.canonicalId);
          const presentation = presentSkill(skill);
          const readers = agents.filter((agent) => canAgentReadSkill(skill.instances, cells[skill.id] ?? [], agent.id));
          const supported = agents.filter((agent) => agent.resolvedGlobalDir);
          const allAgents = supported.length > 0 && supported.every((agent) => readers.some((reader) => reader.id === agent.id));
          const priority = ['codex', 'claude-code', 'cursor'];
          const ordered = [...readers].sort((a, b) => (priority.includes(a.id) ? priority.indexOf(a.id) : 3) - (priority.includes(b.id) ? priority.indexOf(b.id) : 3));
          const shown = ordered.slice(0, 3);
          const remaining = ordered.slice(3);
          return (
            <article className="surface skill-card" key={skill.id} aria-label={skill.name}>
              <div className="card-share"><ShareSkillButton skill={skill} /><IconButton label="Manage visibility" onClick={() => setSelectedId(skill.id)}><Eye aria-hidden="true" /></IconButton></div>
              <div className="skill-card-copy">
                <h2 aria-label={presentation.title}><Link className="card-open" aria-label={`Open ${presentation.title}`} to={`/skills/${encodeURIComponent(skill.id)}`}>{presentation.title}</Link></h2>
                <span className="skill-slug">{skill.name}</span><p>{presentation.summary}</p>
              </div>
              <div className="skill-location" title={canonical?.absPath} aria-label={`Agent access for ${skill.name}`}>
                {allAgents ? <span className="all-agents-mark" title="Available to all known agents"><Globe size={20} role="img" aria-label="Available to all agents" /></span> : <>{shown.map((agent) => <AgentBadge key={agent.id} id={agent.id} name={agent.name} />)}{remaining.length ? <span className="agent-overflow-count" title={remaining.map((agent) => agent.name).join(', ')} aria-label={`${remaining.length} more agents`}>+{remaining.length}</span> : null}</>}
              </div>
            </article>
          );
        })}
      </div>
      {selected ? <Dialog title={`Manage ${selected.name}`} onClose={() => setSelectedId(null)}>
        <SkillSharingActions skill={selected} cells={cells[selected.id] ?? []} />
      </Dialog> : null}
    </>
  );
}
