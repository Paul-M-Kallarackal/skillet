import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { PlanDialog } from './PlanDialog';
import { useToast } from './Toaster';
import type { FsStep, Skill, TriggerChanges, VisibilityCell } from '../api/client.types';

const CLAUDE_OVERRIDES = ['on', 'name-only', 'user-invocable-only', 'off'];

const selectStyle: CSSProperties = {
  padding: '5px 8px',
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  font: 'inherit'
};

const captionStyle: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 };

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

export function TriggerPanel(props: { skill: Skill; cells: VisibilityCell[] }) {
  const { refresh } = useIndex();
  const toast = useToast();
  const [agentId, setAgentId] = useState('claude-code');
  const [changes, setChanges] = useState<TriggerChanges>({
    disableModelInvocation: false,
    userInvocable: true,
    paths: [],
    claudeOverride: '',
    claudeOverrideScope: 'global',
    codexEnabled: true
  });
  const [plan, setPlan] = useState<FsStep[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let source = props.skill.instances[0];
    for (const instance of props.skill.instances) {
      if (instance.readers.includes(agentId)) {
        source = instance;
        break;
      }
    }
    if (!source) {
      return;
    }
    let scope: 'global' | 'project' = 'global';
    if (props.skill.scope === 'project') {
      scope = 'project';
    }
    let codexEnabled = true;
    for (const cell of props.cells) {
      if (cell.agentId === 'codex' && cell.state === 'off') {
        codexEnabled = false;
      }
    }
    setChanges({
      disableModelInvocation: source.frontmatter.disableModelInvocation,
      userInvocable: source.frontmatter.userInvocable,
      paths: source.frontmatter.paths,
      claudeOverride: '',
      claudeOverrideScope: scope,
      codexEnabled
    });
  }, [props.skill, props.cells, agentId]);

  const available: string[] = [];
  for (const cell of props.cells) {
    if (cell.state === 'n-a') {
      continue;
    }
    available.push(cell.agentId);
  }

  const preview = () => {
    setBusy(true);
    api
      .trigger(props.skill.id, { agentId, changes, dryRun: true })
      .then((result) => {
        if (result.steps.length === 0) {
          toast.push('Nothing to change', 'ok');
          return;
        }
        setPlan(result.steps);
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'preview failed'), 'error'))
      .finally(() => setBusy(false));
  };

  const apply = () => {
    setBusy(true);
    api
      .trigger(props.skill.id, { agentId, changes, dryRun: false })
      .then(() => {
        setPlan([]);
        refresh();
        toast.push('Trigger updated', 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'apply failed'), 'error'))
      .finally(() => setBusy(false));
  };

  const readOnly = props.skill.scope === 'plugin';

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 660 }}>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={captionStyle}>agent to configure</span>
        <select value={agentId} onChange={(event) => setAgentId(event.target.value)} style={selectStyle}>
          {available.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={captionStyle}>
          These three live in the SKILL.md itself, so they affect every agent that reads this file.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={changes.disableModelInvocation}
            disabled={readOnly}
            onChange={(event) => setChanges({ ...changes, disableModelInvocation: event.target.checked })}
          />
          <span>
            disable-model-invocation
            <span style={captionStyle}> only you can invoke it</span>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={changes.userInvocable}
            disabled={readOnly}
            onChange={(event) => setChanges({ ...changes, userInvocable: event.target.checked })}
          />
          <span>
            user-invocable
            <span style={captionStyle}> appears in your slash menu</span>
          </span>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={captionStyle}>paths, activates only while editing these globs, comma separated</span>
          <input
            value={changes.paths.join(',')}
            disabled={readOnly}
            onChange={(event) => setChanges({ ...changes, paths: splitCommaList(event.target.value) })}
            style={{ ...selectStyle, width: '100%' }}
          />
        </label>
      </div>

      {agentId === 'claude-code' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={captionStyle}>Claude Code skillOverrides, per machine or per repository</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={changes.claudeOverride}
              onChange={(event) => setChanges({ ...changes, claudeOverride: event.target.value })}
              style={selectStyle}
            >
              <option value="">leave unchanged</option>
              {CLAUDE_OVERRIDES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={changes.claudeOverrideScope}
              onChange={(event) =>
                setChanges({ ...changes, claudeOverrideScope: event.target.value as 'global' | 'project' })
              }
              style={selectStyle}
            >
              <option value="global">write to ~/.claude/settings.local.json</option>
              <option value="project">write to the repo settings.local.json</option>
            </select>
          </div>
        </div>
      ) : null}

      {agentId === 'codex' ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={changes.codexEnabled}
            onChange={(event) => setChanges({ ...changes, codexEnabled: event.target.checked })}
          />
          <span>
            enabled in ~/.codex/config.toml
            <span style={captionStyle}> unchecking writes an enabled = false entry</span>
          </span>
        </label>
      ) : null}

      <div>
        <button className="primary" onClick={preview} disabled={readOnly || busy}>
          Preview changes
        </button>
      </div>

      {plan.length > 0 ? (
        <PlanDialog title="Trigger changes" steps={plan} busy={busy} onConfirm={apply} onCancel={() => setPlan([])} />
      ) : null}
    </div>
  );
}
