import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { useToast } from '../components/Toaster';
import type { SkilletConfig } from '../api/client.types';
import { SegmentedTabs } from '../components/shell/SegmentedTabs';
import { SettingRow } from '../components/shell/SettingRow';
import { Switch } from '../components/shell/Switch';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { useSettingsAutosave } from './settings/useSettingsAutosave';

type SettingsTab = 'general' | 'scanning' | 'appearance';

const MIN_DEPTH = 1;
const MAX_DEPTH = 20;

function splitList(value: string, separator: string): string[] {
  const next: string[] = [];
  for (const part of value.split(separator)) {
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
  const [tab, setTab] = useState<SettingsTab>('general');
  const [rootsText, setRootsText] = useState('');
  const [ignoreText, setIgnoreText] = useState('');
  const [depthText, setDepthText] = useState('');
  const { schedule, status } = useSettingsAutosave(refresh);

  const load = useCallback(() => {
    api
      .getConfig()
      .then((result) => {
        setConfig(result.config);
        setRootsText(result.config.projectRoots.join('\n'));
        setIgnoreText(result.config.ignoreDirs.join(', '));
        setDepthText(String(result.config.maxDepth));
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'could not load settings'), 'error'));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!config) {
    return <div className="empty-state" role="status">Loading settings…</div>;
  }

  const update = (patch: Partial<SkilletConfig>) => {
    setConfig({ ...config, ...patch });
    schedule(patch);
  };

  const editDepth = (value: string) => {
    setDepthText(value);
    const depth = Number(value);
    if (Number.isInteger(depth) && depth >= MIN_DEPTH && depth <= MAX_DEPTH) {
      update({ maxDepth: depth });
    }
  };

  let statusLabel = '';
  if (status === 'saving') {
    statusLabel = 'Saving…';
  } else if (status === 'saved') {
    statusLabel = 'Saved';
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Settings</h1>
          <p className="page-description">Stored in ~/.skillet/config.json. Changes apply instantly.</p>
        </div>
      </div>
      <div className="shell-settings-bar">
        <SegmentedTabs<SettingsTab> label="Settings section" value={tab} onChange={setTab} options={[{ value: 'general', label: 'General' }, { value: 'scanning', label: 'Scanning' }, { value: 'appearance', label: 'Appearance' }]} />
        <span className="shell-save-status" role="status">{statusLabel}</span>
      </div>
      {tab === 'appearance' && <AppearanceSettings initial={config.appearance} />}
      {tab === 'general' && (
        <div className="shell-settings-section">
          <SettingRow title="Hub path" description="Where adopted skills live. Every agent links to this copy.">
            <code className="shell-setting-value">{config.hubPath}</code>
          </SettingRow>
          <SettingRow title="Show every known agent" description="Off: only agents detected on this machine appear in the sidebar, commands and visibility. Turn on to include all known agents.">
            <Switch label="Show every known agent" checked={config.showAllAgents} onChange={(showAllAgents) => update({ showAllAgents })} />
          </SettingRow>
        </div>
      )}
      {tab === 'scanning' && (
        <div className="shell-settings-section">
          <SettingRow title="Project roots" description="Folders Skillet searches for repositories, one per line. Projects without skills are skipped." stacked>
            <textarea className="shell-text-input" rows={4} spellCheck={false} aria-label="Project roots" value={rootsText} onChange={(event) => {
              setRootsText(event.target.value);
              update({ projectRoots: splitList(event.target.value, '\n') });
            }} />
          </SettingRow>
          <SettingRow title="Maximum depth" description={`How many folders deep to look inside each root (${MIN_DEPTH}–${MAX_DEPTH}).`}>
            <input className="shell-text-input shell-number-input" type="number" min={MIN_DEPTH} max={MAX_DEPTH} aria-label="Maximum depth" value={depthText} onChange={(event) => editDepth(event.target.value)} />
          </SettingRow>
          <SettingRow title="Ignored folders" description="Folder names never scanned, separated by commas." stacked>
            <input className="shell-text-input" spellCheck={false} aria-label="Ignored folders" value={ignoreText} onChange={(event) => {
              setIgnoreText(event.target.value);
              update({ ignoreDirs: splitList(event.target.value, ',') });
            }} />
          </SettingRow>
          <p className="shell-settings-note">Skillet rescans on open and every 10 seconds, so changes show up on their own.</p>
        </div>
      )}
    </div>
  );
}
