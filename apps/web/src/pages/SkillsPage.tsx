import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIndex } from '../app/IndexProvider';
import { PluginList } from '../components/shell/PluginList';
import { SkillList } from '../components/shell/SkillList';
import { SegmentedTabs } from '../components/shell/SegmentedTabs';
import type { SegmentedOption } from '../components/shell/SegmentedTabs';
import { isLinkedCell, SCOPE_LABELS } from '../components/shell/skill-visibility';
import { RESULT_COUNT_EVENT } from '../components/command-bar/command-bar.constants';
import { presentSkill } from '../components/skill-presentation';
import type { Skill } from '../api/client.types';

export function SkillsPage() {
  const { index, loading, error, refresh } = useIndex();
  const [params, setParams] = useSearchParams();

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

  let query = params.get('q');
  if (!query) {
    query = '';
  }

  const hubOnly = params.get('hub') === '1';
  const { filtered, scopeCounts } = useMemo(() => {
    const out: Skill[] = [];
    // Counts per scope follow every other active filter, so the tabs describe the list you are looking at.
    const counts = new Map<string, number>();
    if (!index) {
      return { filtered: out, scopeCounts: counts };
    }
    const needle = query.trim().toLowerCase();
    for (const skill of index.skills) {
      if (hubOnly && !skill.instances.some((instance) => instance.isHub)) continue;
      const identicalGlobal = skill.scope === 'project' && index.skills.some((candidate) => candidate.scope === 'global' && candidate.name === skill.name && !candidate.diverged && skill.instances.every((local) => Boolean(local.contentHash) && candidate.instances.some((global) => global.contentHash === local.contentHash)));
      if (identicalGlobal && (!scope && !repo && !agent)) continue;
      const presentation = presentSkill(skill);
      if (repo.length > 0 && skill.repoId !== repo) {
        continue;
      }
      if (needle.length > 0) {
        const haystack = `${skill.name} ${skill.description} ${presentation.title} ${presentation.summary}`.toLowerCase();
        if (!haystack.includes(needle)) {
          continue;
        }
      }
      if (agent.length > 0) {
        let cells = index.cells[skill.id];
        if (!cells) {
          cells = [];
        }
        let readable = skill.instances.some((instance) => instance.readers?.includes(agent)) && !cells.some((cell) => cell.agentId === agent && cell.state === 'off');
        for (const cell of cells) {
          if (cell.agentId !== agent) {
            continue;
          }
          if (isLinkedCell(cell)) {
            readable = true;
          }
        }
        if (!readable) {
          continue;
        }
      }
      counts.set(skill.scope, (counts.get(skill.scope) ?? 0) + 1);
      counts.set('', (counts.get('') ?? 0) + 1);
      if (scope.length > 0 && skill.scope !== scope) {
        continue;
      }
      out.push(skill);
    }
    return { filtered: out, scopeCounts: counts };
  }, [index, scope, repo, agent, query, hubOnly]);

  // Lets the command bar show "N results" for the list it is filtering.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(RESULT_COUNT_EVENT, { detail: filtered.length }));
  }, [filtered.length]);

  if (loading && !index) {
    return <div className="empty-state" role="status">Scanning your machine...</div>;
  }
  if (error.length > 0 && !index) {
    return <div className="empty-state"><p role="alert">{error}</p><button onClick={refresh}>Retry scan</button></div>;
  }
  if (!index) {
    return <div>No index yet.</div>;
  }

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

  const scopeOptions: SegmentedOption<string>[] = [{ value: '', label: 'All', count: scopeCounts.get('') ?? 0 }];
  for (const scopeValue of ['global', 'project', 'plugin']) {
    scopeOptions.push({ value: scopeValue, label: SCOPE_LABELS[scopeValue] ?? scopeValue, count: scopeCounts.get(scopeValue) ?? 0 });
  }
  const setScope = (value: string) => {
    const next = new URLSearchParams(params);
    if (value.length > 0) {
      next.set('scope', value);
    } else {
      next.delete('scope');
    }
    setParams(next);
  };
  const clearSearch = () => {
    const next = new URLSearchParams(params);
    next.delete('q');
    setParams(next);
  };

  let description = '';
  if (scope === 'plugin') {
    description = "Plugins are managed by Claude Code. Disable or uninstall a whole plugin; single plugin skills can't be removed.";
  }
  if (agent.length > 0) {
    description = 'This filters the list. To give another agent access, use Manage visibility on the skill.';
  }
  if (hubOnly) {
    description = 'Skills stored in your central library. Use Manage visibility on a skill to make it available to an agent.';
  }

  let countLabel = String(filtered.length);
  if (query.length > 0) {
    countLabel = `${filtered.length} of ${index.skills.length} match “${query}”`;
  }

  return (
    <div className="skills-page">
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row"><h1>{heading}</h1><span className="page-count">{countLabel}</span></div>
          {description.length > 0 && <p className="page-description">{description}</p>}
        </div>
        <div className="page-actions">
          {query.length > 0 && <button type="button" className="shell-clear-search" onClick={clearSearch}>Clear search</button>}
          {query.length === 0 && <SegmentedTabs<string> label="Scope" value={scope} onChange={setScope} options={scopeOptions} />}
        </div>
      </div>
      {scope === 'plugin' && <PluginList plugins={index.plugins} skills={filtered} filtering={query.length > 0 || agent.length > 0 || repo.length > 0} />}
      {scope !== 'plugin' && (
        <SkillList skills={filtered} agents={index.agents} cells={index.cells} highlight={query} emptyMessage="No skills match. Press esc in the bar below to clear the search." />
      )}
    </div>
  );
}
