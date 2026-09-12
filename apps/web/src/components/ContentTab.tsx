import { Select } from './Select';
import { TriggerPanel } from './TriggerPanel';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { IconButton } from './IconButton';
import { MarkdownView } from './MarkdownView';
const BodyEditor = lazy(() => import('./BodyEditor').then((module) => ({ default: module.BodyEditor }))); 
import { FrontmatterForm } from './FrontmatterForm';
import { PlanDialog } from './PlanDialog';
import { useToast } from './Toaster';
import type { FsStep, Skill, SkillFrontmatter } from '../api/client.types';



export function ContentTab(props: { skill: Skill }) {
  const { refresh } = useIndex();
  const toast = useToast();
  const [instanceId, setInstanceId] = useState(props.skill.canonicalId);
  const [frontmatter, setFrontmatter] = useState<SkillFrontmatter | null>(null);
  const [body, setBody] = useState('');
  const [plan, setPlan] = useState<FsStep[]>([]);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dirtyRef = useRef(false);
  const loadedInstanceRef = useRef('');
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const collapseOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !previewRef.current?.contains(event.target)) setExpanded(false);
    };
    document.addEventListener('pointerdown', collapseOutside);
    return () => document.removeEventListener('pointerdown', collapseOutside);
  }, [expanded]);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<'save' | 'trash' | null>(null);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    setInstanceId(props.skill.canonicalId);
  }, [props.skill.canonicalId]);

  useEffect(() => {
    if (loadedInstanceRef.current === instanceId && dirtyRef.current) return;
    loadedInstanceRef.current = instanceId;
    dirtyRef.current = false;
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
    setFailure('');
    api
      .putContent(props.skill.id, { instanceId, frontmatter, body, dryRun: true })
      .then((result) => { setPlan(result.steps); setOperation('save'); })
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
        setOperation(null);
        refresh();
        dirtyRef.current = false;
        toast.push('Saved to disk', 'ok');
      })
      .catch((cause: unknown) => setFailure(errorMessage(cause, 'Save failed. Review the file and try again.')))
      .finally(() => setBusy(false));
  };

  const trash = () => {
    setBusy(true);
    api
      .trash(props.skill.id, { dryRun: false })
      .then(() => {
        setOperation(null); setPlan([]);
        refresh();
        toast.push('Moved to trash, restorable from the Trash page', 'ok');
      })
      .catch((cause: unknown) => setFailure(errorMessage(cause, 'Move to trash failed. Check the file and try again.')))
      .finally(() => setBusy(false));
  };

  const prepare = async (action: 'trash') => {
    setBusy(true); setFailure('');
    try {
      const result = await api.trash(props.skill.id, { dryRun: true });
      setPlan(result.steps); setOperation(action);
    } catch (cause) { setFailure(errorMessage(cause, 'Could not prepare this change. Nothing was applied.')); }
    finally { setBusy(false); }
  };

  if (!frontmatter) {
    return <div>Loading content...</div>;
  }

  return (
    <div>
      {failure && !operation ? <p className="inline-feedback" role="alert">{failure}</p> : null}
      {props.skill.instances.length > 1 ? (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Editing copy</span>
          <Select value={instanceId} onChange={(event) => setInstanceId(event.target.value)}>
            {props.skill.instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.absPath}
              </option>
            ))}
          </Select>
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

      <FrontmatterForm value={frontmatter} onChange={(value) => { dirtyRef.current = true; setFrontmatter(value); }} readOnly={readOnly} />
      <TriggerPanel skill={props.skill} onChange={(automatic) => setFrontmatter((current) => current ? { ...current, disableModelInvocation: !automatic, userInvocable: true } : current)} />
      <div className="instructions-toolbar"><strong>Instructions</strong><button onClick={() => setEditing(!editing)}>{editing ? 'Preview' : 'Edit Markdown'}</button></div>
      {editing ? <Suspense fallback={<p>Loading editor…</p>}><BodyEditor value={body} onChange={(value) => { dirtyRef.current = true; setBody(value); }} readOnly={readOnly} /></Suspense> : <div ref={previewRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }} className={`markdown-preview${expanded ? ' expanded' : ''}`}>
        {/* Keyboard users can scroll the expanded reader. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className="markdown-reader" role="region" aria-label="Skill instructions preview" tabIndex={expanded ? 0 : -1}><MarkdownView value={body} /></div>
        <button className="markdown-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span className="button-content">{expanded ? 'Collapse instructions' : 'Read full instructions'}{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</span></button>
      </div>}
      <div className="content-savebar">
        {readOnly ? <span>Plugin skills are read-only</span> : null}
        <IconButton label="Move to trash" disabled={readOnly || busy} onClick={() => void prepare('trash')}><Trash2 aria-hidden="true" /></IconButton>
        <button className="primary" onClick={preview} disabled={readOnly || busy}>Save</button>
      </div>

      {operation ? (
        <PlanDialog
          title={operation === 'save' ? 'Save SKILL.md' : `Move ${props.skill.name} to trash`}
          steps={plan}
          busy={busy}
          error={failure}
          onConfirm={() => { setFailure(''); if (operation === 'trash') trash(); else apply(); }}
          onCancel={() => { setPlan([]); setOperation(null); setFailure(''); }}
        />
      ) : null}
    </div>
  );
}
