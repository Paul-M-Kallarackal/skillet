import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { useToast } from '../components/Toaster';
import type { SkilletConfig } from '../api/client.types';

function splitLines(value: string): string[] {
  const next: string[] = [];
  for (const line of value.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      next.push(trimmed);
    }
  }
  return next;
}

function splitCommaList(value: string): string[] {
  const next: string[] = [];
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      next.push(trimmed);
    }
  }
  return next;
}

export function SettingsPage() {
  const { refresh } = useIndex();
  const toast = useToast();
  const [config, setConfig] = useState<SkilletConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getConfig()
      .then((result) => setConfig(result.config))
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'could not load settings'), 'error'));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!config) {
    return <div>Loading settings...</div>;
  }

  const save = () => {
    setBusy(true);
    api
      .putConfig({
        projectRoots: config.projectRoots,
        maxDepth: config.maxDepth,
        ignoreDirs: config.ignoreDirs,
        showAllAgents: config.showAllAgents
      })
      .then(() => {
        refresh();
        toast.push('Saved and rescanned', 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'save failed'), 'error'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-eyebrow">Workspace configuration</div>
          <h1>Settings</h1>
          <p className="page-description">Control where Skillet finds projects and how deeply it scans.</p>
        </div>
      </div>
      <div className="surface settings-panel">
      <label className="field">
        <span className="field-label">Hub path</span><span className="field-help">Where adopted skills live</span>
        <input value={config.hubPath} readOnly />
      </label>
      <label className="field">
        <span className="field-label">Project roots</span><span className="field-help">One directory per line</span>
        <textarea
          rows={4}
          value={config.projectRoots.join('\n')}
          onChange={(event) => setConfig({ ...config, projectRoots: splitLines(event.target.value) })}
        />
      </label>
      <label className="field">
        <span className="field-label">Maximum depth</span><span className="field-help">How many directories deep to walk</span>
        <input
          type="number"
          value={config.maxDepth}
          onChange={(event) => setConfig({ ...config, maxDepth: Number(event.target.value) })}
        />
      </label>
      <label className="field">
        <span className="field-label">Ignored directories</span><span className="field-help">Comma separated</span>
        <input
          value={config.ignoreDirs.join(',')}
          onChange={(event) => setConfig({ ...config, ignoreDirs: splitCommaList(event.target.value) })}
        />
      </label>
      <label className="toggle-control settings-toggle">
        <input
          type="checkbox"
          checked={config.showAllAgents}
          onChange={(event) => setConfig({ ...config, showAllAgents: event.target.checked })}
        />
        <span>Include every known agent in the visibility matrix</span>
      </label>
      <div className="settings-actions">
        <button className="primary" onClick={save} disabled={busy}>
          Save and rescan
        </button>
      </div>
      </div>
    </div>
  );
}
