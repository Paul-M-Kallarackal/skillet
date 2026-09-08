import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { useToast } from '../components/Toaster';
import type { SkilletConfig } from '../api/client.types';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg)',
  color: 'var(--text)',
  font: 'inherit'
};

const labelStyle: CSSProperties = { display: 'grid', gap: 4 };
const captionStyle: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 };

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
    <div style={{ maxWidth: 640, display: 'grid', gap: 18 }}>
      <h1 style={{ fontSize: 21, margin: 0 }}>Settings</h1>
      <label style={labelStyle}>
        <span style={captionStyle}>hub path, where adopted skills live</span>
        <input value={config.hubPath} readOnly style={inputStyle} />
      </label>
      <label style={labelStyle}>
        <span style={captionStyle}>project roots to scan, one per line</span>
        <textarea
          rows={4}
          value={config.projectRoots.join('\n')}
          onChange={(event) => setConfig({ ...config, projectRoots: splitLines(event.target.value) })}
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        <span style={captionStyle}>how many directories deep to walk</span>
        <input
          type="number"
          value={config.maxDepth}
          onChange={(event) => setConfig({ ...config, maxDepth: Number(event.target.value) })}
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        <span style={captionStyle}>directory names to skip, comma separated</span>
        <input
          value={config.ignoreDirs.join(',')}
          onChange={(event) => setConfig({ ...config, ignoreDirs: splitCommaList(event.target.value) })}
          style={inputStyle}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={config.showAllAgents}
          onChange={(event) => setConfig({ ...config, showAllAgents: event.target.checked })}
        />
        <span>
          include every known agent in the visibility matrix
          <span style={captionStyle}> not just the ones installed here</span>
        </span>
      </label>
      <div>
        <button className="primary" onClick={save} disabled={busy}>
          Save and rescan
        </button>
      </div>
    </div>
  );
}
