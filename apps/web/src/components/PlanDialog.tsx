import { ArrowRight, Check, FileSymlink } from 'lucide-react';
import type { FsStep } from '../api/client.types';
import { Dialog } from './Dialog';

export function PlanDialog(props: { title: string; steps: FsStep[]; busy: boolean; error?: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog title={props.title} description={`${props.steps.length} filesystem step(s) will run. Nothing has changed yet.`} onClose={props.onCancel} busy={props.busy} footer={<div className="dialog-actions">
        <button onClick={props.onCancel} disabled={props.busy}>Cancel</button>
        <button className="primary" onClick={props.onConfirm} disabled={props.busy}><span className="button-content"><Check aria-hidden="true" />{props.busy ? 'Applying…' : 'Apply'}</span></button>
      </div>}>
      <ol className="plan-steps">
        {props.steps.map((entry, position) => (
          <li key={`${entry.op}-${position}`}>
            <span className="plan-operation"><FileSymlink aria-hidden="true" />{entry.op}</span>
            {entry.from ? <code>{entry.from}<ArrowRight aria-label="to" /></code> : null}
            <code>{entry.to}</code>
          </li>
        ))}
      </ol>
      {props.error ? <p className="inline-feedback" role="alert">{props.error}</p> : null}

    </Dialog>
  );
}
