import { Check } from 'lucide-react';
import type { FsStep } from '../api/client.types';
import { Dialog } from './Dialog';

const OP_TITLES: Record<string, string> = {
  move: 'Move',
  unlink: 'Remove link',
  symlink: 'Create link',
  writeFile: 'Update file',
  copyDir: 'Copy folder',
  removeDir: 'Remove folder',
  mkdir: 'Create folder'
};

/** Trash entries always create a folder and a manifest first; they are bookkeeping, not something to review. */
function isBookkeeping(entry: FsStep): boolean {
  return entry.note.startsWith('create trash entry') || entry.note === 'write trash manifest first';
}

function shortPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~');
}

/** Paper: 08 Move skill to trash — preview. Every write shows its steps first and runs only on confirm. */
export function PlanDialog(props: { title: string; steps: FsStep[]; busy: boolean; error?: string; confirmLabel?: string; note?: string; onConfirm: () => void; onCancel: () => void }) {
  const visible: FsStep[] = [];
  for (const entry of props.steps) {
    if (!isBookkeeping(entry)) {
      visible.push(entry);
    }
  }
  const hidden = props.steps.length - visible.length;
  let description = `${visible.length} steps will run. Nothing has changed yet.`;
  if (visible.length === 1) {
    description = '1 step will run. Nothing has changed yet.';
  }
  if (hidden > 0) {
    description = `${description.replace('. Nothing', `, plus ${hidden} bookkeeping steps. Nothing`)}`;
  }
  let confirmLabel = props.confirmLabel ?? 'Apply';
  if (props.busy) {
    confirmLabel = 'Applying…';
  }
  const footer = (
    <div className="dialog-actions">
      <button onClick={props.onCancel} disabled={props.busy}>Cancel</button>
      <button className="primary" onClick={props.onConfirm} disabled={props.busy}><span className="button-content"><Check aria-hidden="true" />{confirmLabel}</span></button>
    </div>
  );
  return (
    <Dialog title={props.title} description={description} onClose={props.onCancel} busy={props.busy} footer={footer}>
      <ol className="shell-plan-steps">
        {visible.map((entry, position) => {
          let path = shortPath(entry.to);
          if (entry.from) {
            path = `${shortPath(entry.from)} → ${shortPath(entry.to)}`;
          }
          return (
            <li key={`${entry.op}-${position}`}>
              <span className="shell-plan-index">{position + 1}</span>
              <span className="shell-plan-copy">
                <span className="shell-plan-title">{OP_TITLES[entry.op] ?? entry.op}</span>
                <span className="shell-plan-path">{path}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {props.note && props.note.length > 0 && <p className="shell-callout is-info">{props.note}</p>}
      {props.error ? <p className="inline-feedback" role="alert">{props.error}</p> : null}
    </Dialog>
  );
}
