import { ChevronRight, ListFilter } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from '../IconButton';
import { readFlag, writeFlag } from './storage';

export interface SectionFilter {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SidebarSection({ title, storageKey, actions, filter, children }: { title: string; storageKey: string; actions?: ReactNode; filter?: SectionFilter; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => readFlag(storageKey, false));
  const [filtering, setFiltering] = useState(false);
  const toggle = () => {
    writeFlag(storageKey, !collapsed);
    setCollapsed(!collapsed);
  };
  const toggleFilter = () => {
    if (filtering && filter) {
      filter.onChange('');
    }
    setFiltering(!filtering);
  };
  let chevronClass = 'shell-section-chevron';
  if (!collapsed) {
    chevronClass += ' is-open';
  }
  return (
    <section className="shell-section" aria-label={title}>
      <div className="sidebar-group-label shell-section-heading">
        <button type="button" className="shell-section-toggle" aria-expanded={!collapsed} onClick={toggle}>
          {title}<ChevronRight className={chevronClass} aria-hidden="true" />
        </button>
        <span className="shell-section-actions">
          {actions}
          {filter && <IconButton label={`Filter ${title.toLowerCase()}`} aria-pressed={filtering} onClick={toggleFilter}><ListFilter aria-hidden="true" /></IconButton>}
        </span>
      </div>
      {filter && filtering && !collapsed && (
        <input className="shell-section-filter" type="search" ref={(node) => node?.focus()} placeholder={filter.placeholder} aria-label={filter.placeholder} value={filter.value} onChange={(event) => filter.onChange(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Escape') {
            toggleFilter();
          }
        }} />
      )}
      {!collapsed && <div className="shell-section-body">{children}</div>}
    </section>
  );
}
