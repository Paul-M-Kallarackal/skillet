import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { BodyEditor } from './BodyEditor';
import { FrontmatterForm } from './FrontmatterForm';
import { PlanDialog } from './PlanDialog';
import { useToast } from './Toaster';
import type { FsStep, Skill, SkillFrontmatter } from '../api/client.types';

const selectStyle: CSSProperties = {
  padding: '4px 8px',
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  font: 'inherit',
  maxWidth: 620
};

export function ContentTab(props: { skill: Skill }) {
  const { refresh } = useIndex();
  const toast = useToast();
  const [instanceId, setInstanceId] = useState(props.skill.canonicalId);
  const [frontmatter, setFrontmatter] = useState<SkillFrontmatter | null>(null);
  const [body, setBody] = useState('');
  const [plan, setPlan] = useState<FsStep[]>([]);
  const [renaming, setRenaming] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstanceId(props.skill.canonicalId);
  }, [props.skill.canonicalId]);

  useEffect(() => {
    for (const instance of props.skill.instances) {
      if (instance.id === instanceId) {
        setFrontmatter(instance.frontmatter);
        setBody(instance.body);
        return;
      }
    }
  }, [props.skill, instanceId]);

  const readOnly = props.skill.scope === 'plugin';

  const preview = () => {
    if (!frontmatter) {
      return;
    }
    setBusy(true);
    api
      .putContent(props.skill.id, { instanceId, frontmatter, body, dryRun: true })
      .then((result) => setPlan(result.steps))
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'preview failed'), 'error'))
      .finally(() => setBusy(false));
  };

  const apply = () => {
    if (!frontmatter) {
      return;
    }
    setBusy(true);
    api
      .putContent(props.skill.id, { instanceId, frontmatter, body, dryRun: false })
      .then(() => {
        setPlan([]);
        refresh();
        toast.push('Saved to disk', 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'save failed'), 'error'))
      .finally(() => setBusy(false));
  };

  const rename = () => {
    setBusy(true);
    api
      .rename(props.skill.id, { newName: renaming, dryRun: false })
      .then(() => {
        setRenaming('');
        refresh();
        toast.push(`Renamed to ${renaming}`, 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'rename failed'), 'error'))
      .finally(() => setBusy(false));
  };

  const trash = () => {
    setBusy(true);
    api
      .trash(props.skill.id, { dryRun: false })
      .then(() => {
        refresh();
        toast.push('Moved to trash, restorable from the Trash page', 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'trash failed'), 'error'))
      .finally(() => setBusy(false));
  };

  if (!frontmatter) {
    return <div>Loading content...</div>;
  }

  return (
    <div>
      {props.skill.instances.length > 1 ? (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>editing copy</span>
          <select value={instanceId} onChange={(event) => setInstanceId(event.target.value)} style={selectStyle}>
            {props.skill.instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.absPath}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {props.skill.errors.length > 0 ? (
        <ul style={{ margin: '0 0 16px', paddingLeft: 18 }}>
          {props.skill.errors.map((entry) => {
            let color = 'var(--amber)';
            if (entry.severity === 'error') {
              color = 'var(--red)';
            }
            return (
              <li key={entry.code} style={{ color }}>
                {entry.message}
              </li>
            );
          })}
        </ul>
      ) : null}

      <FrontmatterForm value={frontmatter} onChange={setFrontmatter} readOnly={readOnly} />
      <BodyEditor value={body} onChange={setBody} readOnly={readOnly} />

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" onClick={preview} disabled={readOnly || busy}>
          Save
        </button>
        {readOnly ? (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            plugin skills are read-only
          </span>
        ) : null}
        <div style={{ flex: 1 }} />
        <input
          value={renaming}
          onChange={(event) => setRenaming(event.target.value)}
          placeholder="new-name"
          style={{ ...selectStyle, width: 180 }}
        />
        <button onClick={rename} disabled={readOnly || busy || renaming.length === 0}>
          Rename
        </button>
        <button
          onClick={trash}
          disabled={readOnly || busy}
          style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
        >
          Move to trash
        </button>
      </div>

      {plan.length > 0 ? (
        <PlanDialog
          title="Save SKILL.md"
          steps={plan}
          busy={busy}
          onConfirm={apply}
          onCancel={() => setPlan([])}
        />
      ) : null}
    </div>
  );
}
