import { PanelLeft, RefreshCw } from 'lucide-react';
import { IconButton } from '../IconButton';

export function SidebarHeader({ collapsed, rescanning, onRescan, onToggle }: { collapsed: boolean; rescanning: boolean; onRescan: () => void; onToggle: () => void }) {
  let rescanClass = '';
  if (rescanning) {
    rescanClass = 'is-spinning';
  }
  let toggleLabel = 'Collapse sidebar';
  if (collapsed) {
    toggleLabel = 'Expand sidebar';
  }
  let brand = (
    <span className="shell-brand">
      <img src="/brand/skillet.png" width="24" height="24" alt="" />
      <span className="shell-brand-name">Skillet</span>
    </span>
  );
  if (collapsed) {
    brand = (
      <button type="button" className="shell-brand-button" aria-label="Expand sidebar" title="Expand sidebar" onClick={onToggle}>
        <img src="/brand/skillet.png" width="24" height="24" alt="" />
      </button>
    );
  }
  return (
    <div className="shell-sidebar-header">
      {brand}
      <span className="shell-header-actions">
        <IconButton label="Rescan" onClick={onRescan} disabled={rescanning}><RefreshCw className={rescanClass} aria-hidden="true" /></IconButton>
        <IconButton label={toggleLabel} onClick={onToggle}><PanelLeft aria-hidden="true" /></IconButton>
      </span>
    </div>
  );
}
