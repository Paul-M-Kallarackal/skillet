import type { CSSProperties } from 'react';
import type { FsStep } from '../api/client.types';

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 40,
  padding: 24
};

const panelStyle: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 20,
  width: 760,
  maxWidth: '100%',
  maxHeight: '80vh',
  overflowY: 'auto'
};

export function PlanDialog(props: {
  title: string;
  steps: FsStep[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={backdropStyle} onClick={props.onCancel}>
      <div style={panelStyle} onClick={(event) => event.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{props.title}</div>
        <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
          {`${props.steps.length} filesystem step(s) will run. Nothing has changed yet.`}
        </div>
        <ol style={{ paddingLeft: 20, margin: '0 0 18px', display: 'grid', gap: 5 }}>
          {props.steps.map((entry, position) => {
            let detail = entry.to;
            if (entry.op === 'move' || entry.op === 'copyDir' || entry.op === 'symlink') {
              detail = `${entry.from}  to  ${entry.to}`;
            }
            return (
              <li key={`${entry.op}-${position}`} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                <span style={{ color: 'var(--accent)' }}>{entry.op}</span> {detail}
              </li>
            );
          })}
        </ol>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={props.onCancel}>Cancel</button>
          <button className="primary" onClick={props.onConfirm} disabled={props.busy}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
