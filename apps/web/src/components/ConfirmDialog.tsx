import { Dialog } from './Dialog';

export function ConfirmDialog({ title, description, action = 'Install', busy, error, onConfirm, onCancel }: {
  title: string; description: string; action?: string; busy: boolean; error: string; onConfirm: () => void; onCancel: () => void;
}) {
  return <Dialog title={title} busy={busy} onClose={onCancel} footer={<>
    <button disabled={busy} onClick={onCancel}>Cancel</button>
    <button className="primary" disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : action}</button>
  </>}><p>{description}</p>{error ? <p className="inline-feedback" role="alert">{error}</p> : null}</Dialog>;
}
