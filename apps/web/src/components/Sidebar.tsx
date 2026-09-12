import { Bot, Boxes, Menu, PackageCheck, Search, Settings2, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useIndex } from '../app/IndexProvider';
import { AgentIcon } from './AgentIcon';
import { isCommonAgent } from './common-agents';

export function Sidebar() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { index } = useIndex();
  const [params] = useSearchParams();
  const location = useLocation();
  const onSkills = location.pathname === '/skills';
  const activeScope = onSkills ? params.get('scope') ?? '' : '';
  const activeRepo = onSkills ? params.get('repo') ?? '' : '';
  const activeAgent = onSkills ? params.get('agent') ?? '' : '';
  const activeHub = onSkills && params.get('hub') === '1';
  const noFilter = activeScope.length === 0 && activeRepo.length === 0 && activeAgent.length === 0 && !activeHub;

  if (!index) return <aside className="sidebar" aria-label="Primary navigation" />;

  const installedAgents = index.agents.filter((agent) => agent.installed || agent.custom || isCommonAgent(agent.id));

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand">
        <img className="sidebar-skillet" src="/brand/skillet.png" width="44" height="44" alt="Skillet" />
        <button className="icon-button mobile-nav-toggle" aria-label="Toggle navigation" aria-expanded={navigationOpen} aria-controls="skillet-navigation" onClick={() => setNavigationOpen((current) => !current)}>{navigationOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
      </div>
      <nav id="skillet-navigation" className="sidebar-navigation" data-open={navigationOpen} aria-label="Workspace">
      
      <Link className={`sidebar-link${onSkills && noFilter ? ' active' : ''}`} aria-current={onSkills && noFilter ? 'page' : undefined} to="/skills">
        <Boxes aria-hidden="true" /><span className="sidebar-link-label">All skills</span><span className="sidebar-count">{index.skills.length}</span>
      </Link>
      <Link className={`sidebar-link${location.pathname === '/trash' ? ' active' : ''}`} aria-current={location.pathname === '/trash' ? 'page' : undefined} to="/trash">
        <Trash2 aria-hidden="true" /><span className="sidebar-link-label">Trash</span>
      </Link>

      <div className="sidebar-group-label" title="Filter the list by agent. Use a skill’s Manage visibility control to grant access.">Visible to</div>
      <div className="sidebar-agent-filters">
      {installedAgents.map((agent) => (
        <Link className={`sidebar-link agent-filter${activeAgent === agent.id ? ' active' : ''}`} aria-label={agent.name} title={`${agent.name} · ${agent.installed ? 'Detected' : 'Not detected'}`} aria-description={agent.installed ? 'Detected on this machine' : 'Not detected on this machine'} aria-current={activeAgent === agent.id ? 'page' : undefined} key={agent.id} to={`/skills?agent=${encodeURIComponent(agent.id)}`} onClick={() => setNavigationOpen(false)}>
          <AgentIcon id={agent.id} name={agent.name} decorative /><span className="sidebar-link-label">{agent.name}</span><span className={`agent-status-dot ${agent.installed ? 'detected' : 'not-detected'}`} aria-hidden="true" />
        </Link>
      ))}
      </div>

      <div className="sidebar-group-label">Tools</div>
      <Link className={`sidebar-link${location.pathname === '/discover' ? ' active' : ''}`} aria-current={location.pathname === '/discover' ? 'page' : undefined} to="/discover" onClick={() => setNavigationOpen(false)}>
        <Search aria-hidden="true" /><span className="sidebar-link-label">Find skills</span>
      </Link>
      <Link className={`sidebar-link${location.pathname === '/agents' ? ' active' : ''}`} aria-current={location.pathname === '/agents' ? 'page' : undefined} to="/agents">
        <Bot aria-hidden="true" /><span className="sidebar-link-label">All agents</span><span className="sidebar-count">{index.agents.length}</span>
      </Link>
      <Link className={`sidebar-link${location.pathname === '/adopt' ? ' active' : ''}`} aria-current={location.pathname === '/adopt' ? 'page' : undefined} to="/adopt">
        <PackageCheck aria-hidden="true" /><span className="sidebar-link-label">Adopt into hub</span>
      </Link>
      <Link className={`sidebar-link${location.pathname === '/settings' ? ' active' : ''}`} aria-current={location.pathname === '/settings' ? 'page' : undefined} to="/settings">
        <Settings2 aria-hidden="true" /><span className="sidebar-link-label">Settings</span>
      </Link>

      <div className="sidebar-meta">
        {`scan ${index.scanMs} ms · ${index.repos.length} repos`}
        <br />{`${index.stalePluginVersions} stale plugin caches`}
        <br />press ⌘K to jump
      </div>
      </nav>
    </aside>
  );
}
