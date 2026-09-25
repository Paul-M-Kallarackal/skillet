import { Plug } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { PluginInfo, Skill } from '../../api/client.types';
import { UninstallPluginDialog } from './UninstallPluginDialog';
import { usePlannedAction } from './usePlannedAction';

const ROWS_BEFORE_FOLD = 3;

interface GroupRow {
  key: string;
  name: string;
  summary: string;
  skillId: string;
}

function rowsFor(plugin: PluginInfo, skills: Skill[]): GroupRow[] {
  const rows: GroupRow[] = [];
  if (plugin.enabled) {
    for (const skill of skills) {
      if (skill.pluginName === plugin.key) {
        rows.push({ key: skill.id, name: skill.name, summary: skill.description, skillId: skill.id });
      }
    }
    return rows;
  }
  for (const name of plugin.skillNames) {
    rows.push({ key: name, name, summary: '', skillId: '' });
  }
  return rows;
}

/** Paper: 09 Plugin skills — grouped by plugin. Plugins are removed as a whole. */
export function PluginList({ plugins, skills, filtering }: { plugins: PluginInfo[]; skills: Skill[]; filtering: boolean }) {
  const planned = usePlannedAction();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [uninstalling, setUninstalling] = useState<PluginInfo | null>(null);

  const setEnabled = (plugin: PluginInfo, enabled: boolean) => {
    let title = `Disable ${plugin.name}?`;
    let success = `Disabled ${plugin.name}. Type /undo to turn it back on.`;
    if (enabled) {
      title = `Enable ${plugin.name}?`;
      success = `Enabled ${plugin.name}.`;
    }
    let confirmLabel = 'Disable';
    let note = `Claude Code stops loading its ${plugin.skillNames.length} skills. Type /undo or press Enable to turn it back on.`;
    if (enabled) {
      confirmLabel = 'Enable';
      note = 'Claude Code loads its skills again on the next session.';
    }
    void planned.start(title, (dryRun) => api.setPluginEnabled(plugin.key, { enabled, dryRun }), success, { confirmLabel, note });
  };

  const toggleExpanded = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpanded(next);
  };

  const groups: { plugin: PluginInfo; rows: GroupRow[] }[] = [];
  for (const plugin of plugins) {
    const rows = rowsFor(plugin, skills);
    // While a search or agent filter is active, only plugins with a matching skill stay visible.
    if (filtering && (!plugin.enabled || rows.length === 0)) {
      continue;
    }
    groups.push({ plugin, rows });
  }

  return (
    <div className="shell-plugin-list">
      {groups.map(({ plugin, rows }) => {
        const open = expanded.has(plugin.key);
        const shown: GroupRow[] = [];
        for (const row of rows) {
          if (open || shown.length < ROWS_BEFORE_FOLD) {
            shown.push(row);
          }
        }
        let status = <span className="shell-plugin-status">Enabled</span>;
        let toggle = <button type="button" className="shell-plugin-action" onClick={() => setEnabled(plugin, false)}>Disable</button>;
        if (!plugin.enabled) {
          status = <span className="shell-plugin-status is-off">Disabled</span>;
          toggle = <button type="button" className="primary shell-plugin-enable" onClick={() => setEnabled(plugin, true)}>Enable</button>;
        }
        let countLabel = `${rows.length} skills`;
        if (rows.length === 1) {
          countLabel = '1 skill';
        }
        let more = '';
        if (open && rows.length > ROWS_BEFORE_FOLD) {
          more = 'Show less';
        } else if (rows.length > shown.length) {
          more = `${rows.length - shown.length} more skills · Show all`;
        }
        return (
          <section className="shell-plugin-group" key={plugin.key} aria-label={plugin.name}>
            <div className="shell-plugin-head">
              <span className="shell-plugin-tile" aria-hidden="true"><Plug /></span>
              <span className="shell-plugin-copy">
                <span className="shell-plugin-name">{plugin.name}{status}</span>
                <span className="shell-plugin-meta">{`${countLabel} · ${plugin.marketplace} · Claude Code`}</span>
              </span>
              <span className="shell-plugin-actions">
                {toggle}
                <button type="button" className="shell-plugin-action is-danger" onClick={() => setUninstalling(plugin)}>Uninstall…</button>
              </span>
            </div>
            {shown.map((row) => {
              if (row.skillId.length === 0) {
                return <div className="shell-plugin-row" key={row.key}><span>{row.name}</span></div>;
              }
              return <Link className="shell-plugin-row" key={row.key} to={`/skills/${encodeURIComponent(row.skillId)}`}><span>{row.name}</span><span className="shell-plugin-row-summary">{row.summary}</span></Link>;
            })}
            {rows.length === 0 && <div className="shell-plugin-row is-empty">This plugin adds no skills.</div>}
            {more.length > 0 && <button type="button" className="shell-plugin-more" onClick={() => toggleExpanded(plugin.key)}>{more}</button>}
          </section>
        );
      })}
      {groups.length === 0 && <p className="empty-state" role="status">No plugin skills match.</p>}
      {planned.dialog}
      {uninstalling && (
        <UninstallPluginDialog plugin={uninstalling} onClose={() => setUninstalling(null)} onDisableInstead={() => {
          const plugin = uninstalling;
          setUninstalling(null);
          setEnabled(plugin, false);
        }} />
      )}
    </div>
  );
}
