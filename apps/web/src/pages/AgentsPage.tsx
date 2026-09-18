import { Folder, Globe, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIndex } from '../app/IndexProvider';
import { Badge } from '../components/Badge';
import { AgentIcon } from '../components/AgentIcon';

export function AgentsPage() {
  const { index } = useIndex();

  if (!index) {
    return <div>Scanning your machine...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row"><h1>Agents</h1><span className="page-count">{index.agents.length}</span></div>
          <p className="page-description">An agent is detected when its configuration directory exists on this machine.</p>
        </div>
      </div>
      <div className="agent-inventory">
          {index.agents.map((agent) => (
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
