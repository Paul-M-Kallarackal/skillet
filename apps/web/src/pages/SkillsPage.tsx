import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { SkillCards } from '../components/SkillCards';
import { IconButton } from '../components/IconButton';
import { presentSkill } from '../components/skill-presentation';
import { canAgentReadSkill } from '../components/skill-access';
import { useToast } from '../components/Toaster';
import type { Skill } from '../api/client.types';

export function SkillsPage() {
  const { index, loading, error, refresh } = useIndex();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
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

  const hubOnly = params.get('hub') === '1';
  const filtered = useMemo<Skill[]>(() => {
    if (!index) {
      return [];
    }
    const out: Skill[] = [];
    const needle = query.trim().toLowerCase();
    for (const skill of index.skills) {
      if (hubOnly && !skill.instances.some((instance) => instance.isHub)) continue;
      const presentation = presentSkill(skill);
      if (!skill.instances.some((instance) => (!scope || instance.scope === scope) && (!repo || instance.repoId === repo))) continue;
      if (needle.length > 0) {
        const haystack = `${skill.name} ${skill.description} ${presentation.title} ${presentation.summary}`.toLowerCase();
        if (!haystack.includes(needle)) {
          continue;
        }
      }
      if (agent.length > 0) {
        const matching = skill.instances.filter((instance) => (!scope || instance.scope === scope) && (!repo || instance.repoId === repo));
        if (!canAgentReadSkill(matching, index.cells[skill.id] ?? [], agent)) {
          continue;
        }
      }
      out.push(skill);
    }
    return out;
  }, [index, scope, repo, agent, query, hubOnly]);

  if (loading && !index) {
    return <div className="empty-state" role="status">Scanning your machine...</div>;
  }
  if (error.length > 0 && !index) {
    return <div className="empty-state"><p role="alert">{error}</p><button onClick={refresh}>Retry scan</button></div>;
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
    heading = 'Global skills';
  }
  if (hubOnly) heading = 'Shared hub';
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
    <div className="skills-page">
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row"><h1>{heading}</h1><span className="page-count">{filtered.length}</span></div>
          {hubOnly ? <p className="page-description">Skills stored in your central library. Use Manage visibility on a skill to make it available to an agent.</p> : agent ? <p className="page-description">This filters the list. To give another agent access, use Manage visibility on the skill.</p> : null}
        </div>
        <div className="page-actions">
          <IconButton label={busy ? 'Scanning' : 'Rescan'} onClick={rescan} disabled={busy}><RefreshCw className={busy ? 'is-spinning' : undefined} aria-hidden="true" /></IconButton>
        </div>
      </div>
      <div className="inventory-toolbar">
          <div className="search-wrap">
            <Search aria-hidden="true" />
            <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or description" aria-label="Search skills" />
          </div>
      </div>
      <SkillCards skills={filtered} cells={index.cells} agents={index.agents} />
    </div>
  );
}
