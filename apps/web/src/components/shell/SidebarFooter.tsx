import { Laptop, Settings, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { StaleCache } from '../../api/client.types';
import { Popover } from './Popover';
import { usePlannedAction } from './usePlannedAction';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function SidebarFooter({ repoCount, scanMs, hubPath, staleCaches, watching }: { repoCount: number; scanMs: number; hubPath: string; staleCaches: StaleCache[]; watching: boolean }) {
  const planned = usePlannedAction();
  let status = 'Scanning…';
  if (watching) {
    status = 'Watching';
  }
  const seconds = (scanMs / 1000).toFixed(1);
  let totalBytes = 0;
  for (const cache of staleCaches) {
    totalBytes += cache.bytes;
  }
  let versionsLabel = `${staleCaches.length} old plugin versions`;
  if (staleCaches.length === 1) {
    versionsLabel = '1 old plugin version';
  }
  const cleanUp = (close: () => void) => {
    close();
    void planned.start(`Clean up ${versionsLabel}?`, (dryRun) => api.cleanPluginCache({ dryRun }), `Moved ${versionsLabel} to Trash.`, { confirmLabel: 'Move to Trash', note: 'Each version becomes its own Trash entry, so you can restore any of them.' });
  };
  return (
    <div className="shell-sidebar-footer">
      <Popover placement="above" trigger={({ toggle, open }) => (
        <button type="button" className="shell-footer-status" aria-expanded={open} data-popover-trigger onClick={toggle}>
          <Laptop aria-hidden="true" />
          <span className="shell-footer-copy">
            <span className="shell-footer-line"><strong>This Mac</strong>{watching && <span className="shell-dot" aria-hidden="true" />}<span>{status}</span></span>
            <span className="shell-footer-meta">{`${repoCount} repos · scanned in ${seconds} s`}</span>
          </span>
        </button>
      )}>
        {(close) => (
          <div className="shell-footer-popover">
            <span className="shell-menu-meta">Hub</span>
            <code>{hubPath}</code>
            {staleCaches.length > 0 && (
              <>
                <div className="shell-menu-divider" role="separator" />
                <span className="shell-footer-stale-head"><strong>{versionsLabel}</strong><span>{formatBytes(totalBytes)}</span></span>
                <span className="shell-footer-stale-note">Left behind when Claude Code updated a plugin. No agent reads them.</span>
                <span className="shell-footer-stale-list">
                  {staleCaches.map((cache) => <span key={cache.path}>{`${cache.plugin} ${cache.version}`}</span>)}
                </span>
                <button type="button" role="menuitem" className="shell-menu-item shell-footer-clean" onClick={() => cleanUp(close)}>
                  <span className="shell-menu-icon" aria-hidden="true"><Trash2 /></span>
                  <span className="shell-menu-label">Clean up…</span>
                  <span className="shell-menu-meta">Moves to Trash</span>
                </button>
              </>
            )}
          </div>
        )}
      </Popover>
      <Link className="icon-button shell-footer-settings" to="/settings" aria-label="Settings" title="Settings"><Settings aria-hidden="true" /></Link>
      {planned.dialog}
    </div>
  );
}
