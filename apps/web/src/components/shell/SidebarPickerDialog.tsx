import { Folder, Search } from 'lucide-react';
import { useState } from 'react';
import type { Agent, Repo } from '../../api/client.types';
import { AgentIcon } from '../AgentIcon';
import { Dialog } from '../Dialog';
import { SegmentedTabs } from './SegmentedTabs';
import { Switch } from './Switch';
import { isMainCheckoutWithSkills } from './skill-visibility';

export type PickerTab = 'agents' | 'projects';

export interface PickerResult {
  sidebarAgents: string[] | null;
  sidebarRepos: string[] | null;
}

interface PickerItem {
  id: string;
  label: string;
  detail: string;
  count: string;
  icon: 'agent' | 'folder';
}

function matches(item: PickerItem, query: string): boolean {
  if (query.length === 0) {
    return true;
  }
  return item.label.toLowerCase().includes(query) || item.detail.toLowerCase().includes(query);
}

export function SidebarPickerDialog({ initialTab, agents, repos, counts, shownAgentIds, shownRepoIds, saving, onSave, onClose }: {
  initialTab: PickerTab; agents: Agent[]; repos: Repo[]; counts: Map<string, number>; shownAgentIds: string[]; shownRepoIds: string[]; saving: boolean; onSave: (result: PickerResult) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<PickerTab>(initialTab);
  const [agentDraft, setAgentDraft] = useState(new Set(shownAgentIds));
  const [repoDraft, setRepoDraft] = useState(new Set(shownRepoIds));
  const [query, setQuery] = useState('');

  const items: PickerItem[] = [];
  if (tab === 'agents') {
    for (const agent of agents) {
      items.push({ id: agent.id, label: agent.name, detail: 'Detected on this machine', count: '', icon: 'agent' });
    }
  } else {
    for (const repo of repos) {
      if (!isMainCheckoutWithSkills(repo, counts)) {
        continue;
      }
      const count = counts.get(repo.id) ?? 0;
      let countLabel = `${count} skills`;
      if (count === 1) {
        countLabel = '1 skill';
      }
      let detail = repo.branch;
      if (detail.length === 0) {
        detail = repo.gitRoot.replace(/^\/Users\/[^/]+/, '~');
      }
      items.push({ id: repo.id, label: repo.label, detail, count: countLabel, icon: 'folder' });
    }
  }
  let draft = repoDraft;
  if (tab === 'agents') {
    draft = agentDraft;
  }
  const needle = query.trim().toLowerCase();
  const shown: PickerItem[] = [];
  const hidden: PickerItem[] = [];
  for (const item of items) {
    if (!matches(item, needle)) {
      continue;
    }
    if (draft.has(item.id)) {
      shown.push(item);
    } else {
      hidden.push(item);
    }
  }

  const setChecked = (id: string, checked: boolean) => {
    const next = new Set(draft);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    if (tab === 'agents') {
      setAgentDraft(next);
      return;
    }
    setRepoDraft(next);
  };


  const hideAll = () => {
    if (tab === 'agents') {
      setAgentDraft(new Set());
      return;
    }
    setRepoDraft(new Set());
  };

  const renderRow = (item: PickerItem) => {
    let icon = <Folder aria-hidden="true" />;
    if (item.icon === 'agent') {
      icon = <AgentIcon id={item.id} name={item.label} decorative />;
    }
    return (
      <div className="shell-picker-row" key={item.id}>
        <span className="shell-row-icon">{icon}</span>
        <span className="shell-picker-copy"><span>{item.label}</span><span className="shell-picker-detail">{item.detail}</span></span>
        {item.count.length > 0 && <span className="shell-picker-count">{item.count}</span>}
        <Switch checked={draft.has(item.id)} label={`Show ${item.label} in sidebar`} disabled={saving} onChange={(checked) => setChecked(item.id, checked)} />
      </div>
    );
  };

  let total = 0;
  for (const repo of repos) {
    if (isMainCheckoutWithSkills(repo, counts)) {
      total += 1;
    }
  }
  let noun = 'projects';
  if (tab === 'agents') {
    total = agents.length;
    noun = 'agents';
  }
  const placeholder = `Search ${total} ${noun}`;

  const footer = (
    <div className="dialog-actions shell-picker-actions">
      <button type="button" className="button-link" disabled={saving} onClick={() => onSave({ sidebarAgents: null, sidebarRepos: null })}>Reset to default</button>
      <button type="button" disabled={saving} onClick={onClose}>Cancel</button>
      <button type="button" className="primary" disabled={saving} onClick={() => onSave({ sidebarAgents: [...agentDraft], sidebarRepos: [...repoDraft] })}>Save</button>
    </div>
  );

  return (
    <Dialog title="Edit sidebar" description="Choose what shows on the left. Hidden items stay searchable." busy={saving} onClose={onClose} footer={footer}>
      <div className="shell-picker-toolbar">
        <SegmentedTabs<PickerTab> label="Sidebar section" value={tab} onChange={setTab} options={[{ value: 'agents', label: `Agents ${agentDraft.size}` }, { value: 'projects', label: `Projects ${repoDraft.size}` }]} />
        <span className="shell-picker-shortcuts">
          <button type="button" className="button-link" onClick={hideAll}>Hide all</button>
        </span>
      </div>
      <label className="shell-picker-search"><Search aria-hidden="true" /><input type="search" placeholder={placeholder} aria-label={`Search ${noun}`} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="shell-picker-list">
        {shown.length > 0 && <span className="shell-picker-group">Shown in sidebar</span>}
        {shown.map(renderRow)}
        {hidden.length > 0 && <span className="shell-picker-group">Hidden</span>}
        {hidden.map(renderRow)}
        {shown.length === 0 && hidden.length === 0 && <p className="shell-picker-empty">{`Nothing matches “${query}”.`}</p>}
      </div>
    </Dialog>
  );
}
