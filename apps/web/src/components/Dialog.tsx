import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from './IconButton';
import { X } from 'lucide-react';

/** Native modal semantics provide focus containment, inert background, and Escape. */
export function Dialog({ title, description, children, onClose, busy = false, wide = false, onRename, footer }: {
  footer?: ReactNode; title: string; description?: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean; onRename?: ((name: string) => Promise<void>) | undefined;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draft, setDraft] = useState(title);
  const [renameError, setRenameError] = useState('');
  const [renaming, setRenaming] = useState(false);
  const committing = useRef(false);
  const cancelEdit = useRef(false);
  const commitTitle = async () => {
    if (cancelEdit.current || committing.current || !onRename) return;
    const name = draft.trim();
    if (name === title) { setEditingTitle(false); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
      setRenameError('Use up to 64 lowercase letters, numbers, and hyphens.'); return;
    }
    committing.current = true; setRenaming(true); setRenameError('');
    try { await onRename(name); setEditingTitle(false); }
    catch (error) { setRenameError(error instanceof Error ? error.message : 'Could not rename. Try again.'); }
    finally { committing.current = false; setRenaming(false); }
  };
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editingTitle) { titleInput.current?.focus(); titleInput.current?.select(); } }, [editingTitle]);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    const initial = wide ? dialog?.querySelector<HTMLElement>('h2') : dialog?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') ?? dialog?.querySelector<HTMLElement>('h2');
    initial?.focus();
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [wide]);
  return (
    <dialog ref={ref} className={`app-dialog${wide ? ' skill-detail-dialog' : ''}`} aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined} aria-busy={busy}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!busy && !renaming) onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || !(event.target instanceof Element) || event.target.closest('dialog') !== event.currentTarget) return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length > 0 && element.closest('dialog') === event.currentTarget);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <header className="dialog-header">
        <div className="dialog-heading"><h2 tabIndex={-1} id={titleId}>{editingTitle ? <input ref={titleInput} aria-label="Skill name" value={draft} disabled={renaming} onChange={(event) => setDraft(event.target.value)} onBlur={() => void commitTitle()} onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); void commitTitle(); }
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelEdit.current = true; setEditingTitle(false); setRenameError(''); }
        }} /> : onRename ? <button className="dialog-title-edit" title="Click to rename" aria-label={`Rename ${title}`} onClick={() => { cancelEdit.current = false; setDraft(title); setRenameError(''); setEditingTitle(true); }}>{title}</button> : title}</h2>{renameError ? <p role="alert">{renameError}</p> : null}{description ? <p id={descriptionId}>{description}</p> : null}</div>
        <IconButton label="Close dialog" disabled={busy || renaming} onClick={onClose}><X aria-hidden="true" /></IconButton>
      </header>
      <div className="dialog-body">{children}</div>
      {footer ? <footer className="dialog-footer">{footer}</footer> : null}
    </dialog>
  );
}
