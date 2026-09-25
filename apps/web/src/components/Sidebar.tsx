import { Bot, ChevronDown, Compass, Ellipsis, LayoutGrid, Menu, Package, Search, Settings, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { KeyHint } from './shell/KeyHint';
import { Popover, PopoverDivider, PopoverItem } from './shell/Popover';
import { SidebarAgents } from './shell/SidebarAgents';
import { SidebarFooter } from './shell/SidebarFooter';
import { SidebarHeader } from './shell/SidebarHeader';
import { SidebarPickerDialog } from './shell/SidebarPickerDialog';
import type { PickerResult, PickerTab } from './shell/SidebarPickerDialog';
import { SidebarProjects } from './shell/SidebarProjects';
import { SidebarRow } from './shell/SidebarRow';
import { defaultRepos, detectedAgents, idsOf, pickById, skillCountByRepo } from './shell/sidebar-state';
import { readFlag, writeFlag } from './shell/storage';
import { isMainCheckoutWithSkills } from './shell/skill-visibility';
import { useSidebarConfig } from './shell/useSidebarConfig';
import type { SidebarPatch } from './shell/useSidebarConfig';
import { useToast } from './Toaster';
import { FOCUS_COMMAND_BAR_EVENT } from './command-bar/command-bar.constants';

export function Sidebar() {
  const { index, refresh } = useIndex();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const sidebar = useSidebarConfig();
  const [collapsed, setCollapsed] = useState(() => readFlag('skillet.sidebar.collapsed', false));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [picker, setPicker] = useState<PickerTab | ''>('');
  const [rescanning, setRescanning] = useState(false);

  if (!index) {
    return <aside className="sidebar" aria-label="Primary navigation" />;
  }

  const onSkills = location.pathname === '/skills';
  let activeAgent = '';
  let activeRepo = '';
  if (onSkills) {
    activeAgent = params.get('agent') ?? '';
    activeRepo = params.get('repo') ?? '';
  }
  const allSkillsActive = onSkills && activeAgent.length === 0 && activeRepo.length === 0 && !params.get('scope');

  const detected = detectedAgents(index.agents, index.showAllAgents);
  let agents = detected;
  if (sidebar.agentIds !== null) {
    agents = pickById(detected, sidebar.agentIds);
  }
  const counts = skillCountByRepo(index.skills);
  let repos = defaultRepos(index.repos, counts);
  if (sidebar.repoIds !== null) {
    // A saved project stays hidden while it has no skills, so the section only lists useful filters.
    repos = [];
    for (const repo of pickById(index.repos, sidebar.repoIds)) {
      if ((counts.get(repo.id) ?? 0) > 0) {
        repos.push(repo);
      }
    }
  }
  let mainCheckouts = 0;
  for (const repo of index.repos) {
    if (isMainCheckoutWithSkills(repo, counts)) {
      mainCheckouts += 1;
    }
  }

  const toggleCollapsed = () => {
    writeFlag('skillet.sidebar.collapsed', !collapsed);
    setCollapsed(!collapsed);
  };
  const closeMobile = () => setMobileOpen(false);
  const rescan = () => {
    setRescanning(true);
    api
      .rescan()
      .then(() => refresh())
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'rescan failed'), 'error'))
      .finally(() => setRescanning(false));
  };
  const savePicker = (result: PickerResult) => {
    void sidebar.save(result).then((saved) => {
      if (saved) {
        setPicker('');
      }
    });
  };

  // Until the saved lists load, the visible rows are defaults; saving from them would overwrite the user's choice.
  const hide = (patch: SidebarPatch) => {
    if (sidebar.loaded) {
      void sidebar.save(patch);
    }
  };

  let asideClass = 'sidebar shell-sidebar';
  if (collapsed) {
    asideClass += ' is-collapsed';
  }
  let MobileIcon = Menu;
  if (mobileOpen) {
    MobileIcon = X;
  }

  return (
    <aside className={asideClass} aria-label="Primary navigation">
      <SidebarHeader collapsed={collapsed} rescanning={rescanning} onRescan={rescan} onToggle={toggleCollapsed} />
      <button className="icon-button mobile-nav-toggle" aria-label="Toggle navigation" aria-expanded={mobileOpen} aria-controls="skillet-navigation" onClick={() => setMobileOpen(!mobileOpen)}><MobileIcon aria-hidden="true" /></button>
      <nav id="skillet-navigation" className="sidebar-navigation" data-open={mobileOpen} aria-label="Workspace">
        <button type="button" className="shell-search-trigger" title="Search skills (⌘K)" aria-label="Search skills" onClick={() => window.dispatchEvent(new Event(FOCUS_COMMAND_BAR_EVENT))}>
          <Search aria-hidden="true" /><span className="sidebar-link-label">Search skills</span><KeyHint>⌘K</KeyHint>
        </button>
        <SidebarRow icon={<LayoutGrid />} label="All skills" to="/skills" selected={allSkillsActive} trailing={String(index.skills.length)} onClick={closeMobile} />
        <SidebarRow icon={<Compass />} label="Find skills" to="/discover" selected={location.pathname === '/discover'} onClick={closeMobile} />
        <SidebarRow icon={<Package />} label="Adopt into hub" to="/adopt" selected={location.pathname === '/adopt'} onClick={closeMobile} />
        <Popover placement="right" trigger={({ toggle, open }) => (
          <button type="button" className="sidebar-link shell-row is-muted" title="More" aria-label="More" aria-haspopup="menu" aria-expanded={open} data-popover-trigger onClick={toggle}>
            <span className="shell-row-icon" aria-hidden="true"><ChevronDown className="shell-row-more-icon" /><Ellipsis className="shell-rail-more" /></span><span className="sidebar-link-label">More</span><span className="shell-row-trailing" />
          </button>
        )}>
          {(close) => (
            <>
              <PopoverItem icon={<Bot />} label="All agents" meta={String(index.agents.length)} onSelect={() => { close(); navigate('/agents'); }} />
              <PopoverItem icon={<Trash2 />} label="Trash" onSelect={() => { close(); navigate('/trash'); }} />
              <PopoverItem icon={<Settings />} label="Settings" onSelect={() => { close(); navigate('/settings'); }} />
              <PopoverDivider />
              <PopoverItem label="Edit sidebar…" onSelect={() => { close(); setPicker('agents'); }} />
            </>
          )}
        </Popover>
        <SidebarAgents agents={agents} activeAgent={activeAgent} onNavigate={closeMobile} onEdit={() => setPicker('agents')} onHide={(ids) => hide({ sidebarAgents: ids })} />
        <SidebarProjects repos={repos} counts={counts} hiddenCount={Math.max(0, mainCheckouts - repos.length)} activeRepo={activeRepo} onNavigate={closeMobile} onEdit={() => setPicker('projects')} onHide={(ids) => hide({ sidebarRepos: ids })} />
      </nav>
      <SidebarFooter repoCount={index.repos.length} scanMs={index.scanMs} hubPath={index.hubPath} staleCaches={index.staleCaches} watching={!rescanning} />
      {picker !== '' && (
        <SidebarPickerDialog initialTab={picker} agents={detected} repos={index.repos} counts={counts} shownAgentIds={idsOf(agents)} shownRepoIds={idsOf(repos)} saving={sidebar.saving} onSave={savePicker} onClose={() => setPicker('')} />
      )}
    </aside>
  );
}
