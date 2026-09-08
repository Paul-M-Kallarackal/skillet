import { useState } from 'react';
import { useIndex } from '../app/IndexProvider';
import { Badge } from '../components/Badge';
import type { Agent } from '../api/client.types';

export function AgentsPage() {
  const { index } = useIndex();
  const [showAll, setShowAll] = useState(false);

  if (!index) {
    return <div>Scanning your machine...</div>;
  }

  const rows: Agent[] = [];
  for (const agent of index.agents) {
    if (!agent.installed && !agent.custom && !showAll) {
      continue;
    }
    rows.push(agent);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>Agents</h1>
        <span style={{ color: 'var(--text-muted)' }}>{`${rows.length} of ${index.agents.length}`}</span>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
          show every agent Skillet knows about
        </label>
      </div>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        An agent counts as installed when its configuration directory exists on this machine.
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '18%' }}>Agent</th>
            <th>Global skills directory</th>
            <th style={{ width: 170 }}>Project directory</th>
            <th style={{ width: 115 }}>Detected</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((agent) => (
            <tr key={agent.id}>
              <td>{agent.name}</td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 12, wordBreak: 'break-all' }}>
                {agent.resolvedGlobalDir.length > 0 ? agent.resolvedGlobalDir : 'none'}
              </td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{agent.projectDir}</td>
              <td>
                {agent.installed ? (
                  <Badge tone="green" title="configuration directory found">
                    installed
                  </Badge>
                ) : (
                  <Badge tone="neutral" title="configuration directory not found">
                    not found
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
