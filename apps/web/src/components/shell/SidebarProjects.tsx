import { Folder, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Repo } from '../../api/client.types';
import { IconButton } from '../IconButton';
import { SidebarRow } from './SidebarRow';
import { SidebarSection } from './SidebarSection';
import { DEFAULT_VISIBLE_PROJECTS, idsOf, withoutId } from './sidebar-state';

export function SidebarProjects({ repos, counts, hiddenCount, activeRepo, onHide, onEdit, onNavigate }: { repos: Repo[]; counts: Map<string, number>; hiddenCount: number; activeRepo: string; onHide: (ids: string[]) => void; onEdit: () => void; onNavigate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const shownIds = idsOf(repos);
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const visible: Repo[] = [];
  for (const repo of repos) {
    if (needle.length > 0 && !repo.label.toLowerCase().includes(needle)) {
      continue;
    }
    if (needle.length > 0 || expanded || visible.length < DEFAULT_VISIBLE_PROJECTS) {
      visible.push(repo);
    }
  }
  let overflow = repos.length - visible.length;
  if (needle.length > 0) {
    overflow = 0;
  }
  let moreLabel = '';
  if (expanded && repos.length > DEFAULT_VISIBLE_PROJECTS) {
    moreLabel = 'Show less';
  } else if (overflow > 0) {
    moreLabel = `${overflow} more · Show all`;
  } else if (hiddenCount > 0) {
    moreLabel = `${hiddenCount} hidden · Show all`;
  }
  const showMore = () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (overflow > 0) {
      setExpanded(true);
      return;
    }
    onEdit();
  };
  return (
    <SidebarSection title="Projects" storageKey="skillet.sidebar.projects.collapsed" filter={{ value: filter, onChange: setFilter, placeholder: 'Filter projects' }} actions={<IconButton label="Choose projects" onClick={onEdit}><Plus aria-hidden="true" /></IconButton>}>
      {visible.map((repo) => (
        <SidebarRow key={repo.id} icon={<Folder />} label={repo.label} title={repo.gitRoot} to={`/skills?repo=${encodeURIComponent(repo.id)}`} selected={activeRepo === repo.id} trailing={String(counts.get(repo.id) ?? 0)} onClick={onNavigate} onHide={() => onHide(withoutId(shownIds, repo.id))} />
      ))}
      {repos.length === 0 && <SidebarRow icon={<Plus />} label="Choose projects" muted onClick={onEdit} />}
      {moreLabel.length > 0 && <button type="button" className="shell-row-more" onClick={showMore}>{moreLabel}</button>}
    </SidebarSection>
  );
}
