import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { SkillTable } from '../components/SkillTable';
import { useToast } from '../components/Toaster';
import type { Skill } from '../api/client.types';

const inputStyle: CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg)',
  color: 'var(--text)',
  font: 'inherit',
  width: 260
};

export function SkillsPage() {
  const { index, loading, error, refresh } = useIndex();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  let scope = params.get('scope');
  if (!scope) {
    scope = '';
  }
  let repo = params.get('repo');
  if (!repo) {
    repo = '';
  }
  let agent = params.get('agent');
  if (!agent) {
    agent = '';
  }

  const filtered = useMemo<Skill[]>(() => {
    if (!index) {
      return [];
    }
    const out: Skill[] = [];
    const needle = query.trim().toLowerCase();
    for (const skill of index.skills) {
      if (scope.length > 0 && skill.scope !== scope) {
        continue;
      }
      if (repo.length > 0 && skill.repoId !== repo) {
        continue;
      }
      if (needle.length > 0) {
        const haystack = `${skill.name} ${skill.description}`.toLowerCase();
        if (!haystack.includes(needle)) {
          continue;
        }
      }
      if (agent.length > 0) {
        let cells = index.cells[skill.id];
        if (!cells) {
          cells = [];
        }
        let readable = false;
        for (const cell of cells) {
          if (cell.agentId !== agent) {
            continue;
          }
          if (cell.state !== 'not-linked' && cell.state !== 'n-a') {
            readable = true;
          }
        }
        if (!readable) {
          continue;
        }
      }
      if (onlyProblems) {
        let hasProblem = skill.diverged || skill.shadowed;
        for (const validation of skill.errors) {
          if (validation.severity === 'error') {
            hasProblem = true;
          }
        }
        if (!hasProblem) {
          continue;
        }
      }
      out.push(skill);
    }
    return out;
  }, [index, scope, repo, agent, query, onlyProblems]);

  if (loading && !index) {
    return <div>Scanning your machine...</div>;
  }
  if (error.length > 0 && !index) {
    return <div style={{ color: 'var(--red)' }}>{error}</div>;
  }
  if (!index) {
    return <div>No index yet.</div>;
  }

  const rescan = () => {
    setBusy(true);
    api
      .rescan()
      .then(() => {
        refresh();
        toast.push('Rescanned', 'ok');
      })
      .catch((cause: unknown) => {
        toast.push(errorMessage(cause, 'rescan failed'), 'error');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  let heading = 'All skills';
  if (scope === 'global') {
    heading = 'Global hub skills';
  }
  if (scope === 'plugin') {
    heading = 'Plugin skills';
  }
  if (repo.length > 0) {
    for (const entry of index.repos) {
      if (entry.id === repo) {
        heading = `${entry.label} skills`;
      }
    }
  }
  if (agent.length > 0) {
    for (const entry of index.agents) {
      if (entry.id === agent) {
        heading = `Skills ${entry.name} can read`;
      }
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>{heading}</h1>
        <span style={{ color: 'var(--text-muted)' }}>{filtered.length}</span>
        <div style={{ flex: 1 }} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or description"
          style={inputStyle}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={onlyProblems} onChange={(event) => setOnlyProblems(event.target.checked)} />
          problems only
        </label>
        <button onClick={rescan} disabled={busy}>
          Rescan
        </button>
      </div>
      <SkillTable skills={filtered} cells={index.cells} />
    </div>
  );
}
