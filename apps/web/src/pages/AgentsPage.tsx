import { useState } from 'react';
import { Folder, Globe, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIndex } from '../app/IndexProvider';
import { Badge } from '../components/Badge';
import { AgentIcon } from '../components/AgentIcon';
import { isCommonAgent } from '../components/common-agents';
import type { Agent } from '../api/client.types';

export function AgentsPage() {
  const { index } = useIndex();
  const [showAll, setShowAll] = useState(false);

  if (!index) {
    return <div>Scanning your machine...</div>;
  }

  const rows: Agent[] = [];
  for (const agent of index.agents) {
    if (!agent.installed && !agent.custom && !isCommonAgent(agent.id) && !showAll) {
      continue;
    }
    rows.push(agent);
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row"><h1>Agents</h1><span className="page-count">{`${rows.length}/${index.agents.length}`}</span></div>
          <p className="page-description">An agent is detected when its configuration directory exists on this machine.</p>
        </div>
        <div className="page-actions">
        <label className="toggle-control">
          <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
          Show known agents
        </label>
        </div>
      </div>
      <div className="agent-inventory">
          {rows.map((agent) => (
            <article className="surface skill-card" key={agent.id} aria-label={agent.name}>
              <div className="skill-card-heading"><span className="card-icon"><AgentIcon id={agent.id} name={agent.name} decorative /></span>
                {agent.installed ? (
                  <Badge tone="green" title="configuration directory found">
                    installed
                  </Badge>
                ) : (
                  <Badge tone="neutral" title="configuration directory not found">
                    not found
                  </Badge>
                )}
              </div>
              <div className="skill-card-copy"><h2>{agent.name}</h2></div>
              <dl className="agent-directories">
                <div><dt><Globe aria-hidden="true" />Global skills directory</dt><dd><code>{agent.resolvedGlobalDir || 'Not configured'}</code></dd></div>
                <div><dt><Folder aria-hidden="true" />Project directory</dt><dd><code>{agent.projectDir || 'Not configured'}</code></dd></div>
              </dl>
              <Link className="button-link" to={`/skills?agent=${encodeURIComponent(agent.id)}`}>View available skills<ArrowUpRight aria-hidden="true" /></Link>
            </article>
          ))}
      </div>
    </div>
  );
}
