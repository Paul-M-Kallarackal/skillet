import { useState } from 'react';
import { api, errorMessage } from '../../api/client';
import type { PluginInfo } from '../../api/client.types';
import { useIndex } from '../../app/IndexProvider';
import { Dialog } from '../Dialog';
import { useToast } from '../Toaster';

/** Paper: 10 Uninstall plugin — confirm. Shows the exact Claude Code command before running it. */
export function UninstallPluginDialog({ plugin, onDisableInstead, onClose }: { plugin: PluginInfo; onDisableInstead: () => void; onClose: () => void }) {
  const { refresh } = useIndex();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const command = `claude plugin uninstall ${plugin.key}`;

  const uninstall = async () => {
    setBusy(true);
    setFailure('');
    try {
      await api.uninstallPlugin(plugin.key, { dryRun: false });
      refresh();
      toast.push(`Uninstalled ${plugin.name}`, 'ok');
      onClose();
    } catch (cause) {
      setFailure(errorMessage(cause, 'uninstall failed'));
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <div className="dialog-actions shell-picker-actions">
      {plugin.enabled && <button type="button" className="button-link" disabled={busy} onClick={onDisableInstead}>Disable instead</button>}
      <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button type="button" className="shell-button-danger" disabled={busy} onClick={() => void uninstall()}>{busy ? 'Uninstalling…' : 'Uninstall'}</button>
    </div>
  );

  let skillLine = `Removes the plugin and its ${plugin.skillNames.length} skills from Claude Code.`;
  if (plugin.skillNames.length === 1) {
    skillLine = 'Removes the plugin and its skill from Claude Code.';
  }

  return (
    <Dialog title={`Uninstall ${plugin.name}?`} description={skillLine} busy={busy} onClose={onClose} footer={footer}>
      <div className="shell-command-preview">
        <span className="shell-command-preview-label">SKILLET WILL RUN</span>
        <code className="shell-command-preview-code">{command}</code>
        <span className="shell-command-preview-note">{"Claude Code's own command, so its plugin list and settings stay consistent. Other agents are not affected."}</span>
      </div>
      <p className="shell-callout is-danger">{`This can't be undone from Skillet. To get it back, reinstall with /plugin install ${plugin.name} in Claude Code.`}{plugin.enabled && ' Prefer Disable if you might want it again.'}</p>
      {failure && <p className="inline-feedback" role="alert">{failure}</p>}
    </Dialog>
  );
}
