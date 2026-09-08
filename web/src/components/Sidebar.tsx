import { Link, useLocation, useSearchParams } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useIndex } from '../app/IndexProvider';
import type { Skill } from '../api/client.types';

function countSkills(skills: Skill[], scope: string, repoId: string): number {
  let total = 0;
  for (const skill of skills) {
    if (skill.scope !== scope) {
      continue;
    }
    if (repoId.length > 0 && skill.repoId !== repoId) {
      continue;
    }
    total += 1;
  }
  return total;
}

const asideStyle: CSSProperties = {
  width: 264,
  flexShrink: 0,
  borderRight: '1px solid var(--border)',
  padding: 12,
  overflowY: 'auto',
  background: 'var(--bg-subtle)'
};

const groupLabelStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '16px 10px 4px'
};

function linkStyle(isActive: boolean): CSSProperties {
  let background = 'transparent';
  if (isActive) {
    background = 'var(--accent-soft)';
  }
  return {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    padding: '5px 10px',
    borderRadius: 'var(--radius)',
    background,
    color: 'var(--text)'
  };
}

export function Sidebar() {
  const { index } = useIndex();
  const [params] = useSearchParams();
  const location = useLocation();

  const onSkills = location.pathname === '/skills';
  let activeScope = '';
  let activeRepo = '';
  let activeAgent = '';
  if (onSkills) {
    const scope = params.get('scope');
    const repo = params.get('repo');
    const agent = params.get('agent');
    if (scope) {
      activeScope = scope;
    }
    if (repo) {
      activeRepo = repo;
    }
    if (agent) {
      activeAgent = agent;
    }
  }
  const noFilter = activeScope.length === 0 && activeRepo.length === 0 && activeAgent.length === 0;

  if (!index) {
    return <aside style={asideStyle} />;
  }

  const mainRepos = [];
  for (const repo of index.repos) {
    if (repo.isWorktree) {
      continue;
    }
    if (countSkills(index.skills, 'project', repo.id) === 0 && repo.worktreeIds.length === 0) {
      continue;
    }
    mainRepos.push(repo);
  }

  const installedAgents = [];
  for (const agent of index.agents) {
    if (agent.installed || agent.custom) {
      installedAgents.push(agent);
    }
  }

  return (
    <aside style={asideStyle}>
      <div style={{ fontWeight: 600, fontSize: 15, padding: '4px 10px 8px' }}>Skillet</div>

      <div style={groupLabelStyle}>Scopes</div>
      <Link to="/skills" style={linkStyle(onSkills && noFilter)}>
        <span>All skills</span>
        <span style={{ color: 'var(--text-muted)' }}>{index.skills.length}</span>
      </Link>
      <Link to="/skills?scope=global" style={linkStyle(activeScope === 'global')}>
        <span>Global hub</span>
        <span style={{ color: 'var(--text-muted)' }}>{countSkills(index.skills, 'global', '')}</span>
      </Link>
      {mainRepos.map((repo) => {
        let worktreeLabel = '';
        if (repo.worktreeIds.length > 0) {
          worktreeLabel = ` +${repo.worktreeIds.length} wt`;
        }
        return (
          <Link key={repo.id} to={`/skills?repo=${encodeURIComponent(repo.id)}`} style={linkStyle(activeRepo === repo.id)}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {repo.label}
              <span style={{ color: 'var(--text-muted)' }}>{worktreeLabel}</span>
              {repo.dirty ? <span style={{ color: 'var(--amber)' }}> &bull;</span> : null}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{countSkills(index.skills, 'project', repo.id)}</span>
          </Link>
        );
      })}
      <Link to="/skills?scope=plugin" style={linkStyle(activeScope === 'plugin')}>
        <span>Plugins</span>
        <span style={{ color: 'var(--text-muted)' }}>{countSkills(index.skills, 'plugin', '')}</span>
      </Link>
      <Link to="/trash" style={linkStyle(location.pathname === '/trash')}>
        <span>Trash</span>
      </Link>

      <div style={groupLabelStyle}>Visible to</div>
      {installedAgents.map((agent) => (
        <Link key={agent.id} to={`/skills?agent=${agent.id}`} style={linkStyle(activeAgent === agent.id)}>
          <span>{agent.name}</span>
          <span style={{ color: 'var(--green)', fontSize: 10 }}>&#9679;</span>
        </Link>
      ))}

      <div style={groupLabelStyle}>Tools</div>
      <Link to="/agents" style={linkStyle(location.pathname === '/agents')}>
        <span>All agents</span>
        <span style={{ color: 'var(--text-muted)' }}>{index.agents.length}</span>
      </Link>
      <Link to="/adopt" style={linkStyle(location.pathname === '/adopt')}>
        <span>Adopt into hub</span>
      </Link>
      <Link to="/settings" style={linkStyle(location.pathname === '/settings')}>
        <span>Settings</span>
      </Link>

      <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: '18px 10px 4px', lineHeight: 1.7 }}>
        {`scanned in ${index.scanMs} ms`}
        <br />
        {`${index.repos.length} repos, ${index.stalePluginVersions} stale plugin caches`}
        <br />
        {`press ⌘K to jump`}
      </div>
    </aside>
  );
}
