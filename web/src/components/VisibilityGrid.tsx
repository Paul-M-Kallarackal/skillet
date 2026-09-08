import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';
import { PlanDialog } from './PlanDialog';
import { useToast } from './Toaster';
import type { CellState, FsStep, LinkTarget, Skill, VisibilityCell } from '../api/client.types';

function toneFor(state: CellState): BadgeTone {
  if (state === 'auto') {
    return 'green';
  }
  if (state === 'user-only' || state === 'model-only' || state === 'name-only') {
    return 'amber';
  }
  if (state === 'off') {
    return 'red';
  }
  return 'neutral';
}

function explain(state: CellState): string {
  if (state === 'auto') {
    return 'the agent loads this on its own when the task matches';
  }
  if (state === 'user-only') {
    return 'only you can invoke it, the model cannot';
  }
  if (state === 'model-only') {
    return 'only the model can invoke it, it is hidden from your slash menu';
  }
  if (state === 'name-only') {
    return 'the agent sees the name but not the description';
  }
  if (state === 'off') {
    return 'hidden from this agent entirely';
  }
  if (state === 'not-linked') {
    return 'this agent has no copy of this skill';
  }
  return 'this agent is not installed on this machine';
}

export function VisibilityGrid(props: { skill: Skill; cells: VisibilityCell[] }) {
  const { refresh } = useIndex();
  const toast = useToast();
  const [plan, setPlan] = useState<FsStep[]>([]);
  const [pending, setPending] = useState<(() => Promise<unknown>) | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const stage = (
    previewer: () => Promise<{ steps: FsStep[] }>,
    applier: () => Promise<unknown>,
    label: string
  ) => {
    setBusy(true);
    previewer()
      .then((result) => {
        setPlan(result.steps);
        setPending(() => applier);
        setTitle(label);
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'preview failed'), 'error'))
      .finally(() => setBusy(false));
  };

  const confirm = () => {
    if (!pending) {
      return;
    }
    setBusy(true);
    pending()
      .then(() => {
        setPlan([]);
        setPending(null);
        refresh();
        toast.push('Applied', 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'apply failed'), 'error'))
      .finally(() => setBusy(false));
  };

  const link = (agentId: string) => {
    let target: LinkTarget = { agentId, scope: 'global', repoId: '' };
    let label = `Link into the ${agentId} global directory`;
    if (props.skill.scope === 'project') {
      target = { agentId, scope: 'project', repoId: props.skill.repoId };
      label = `Link into the ${agentId} directory of ${props.skill.repoName}`;
    }
    stage(
      () => api.link(props.skill.id, { target, dryRun: true }),
      () => api.link(props.skill.id, { target, dryRun: false }),
      label
    );
  };

  const unlink = (instanceId: string) => {
    stage(
      () => api.unlink(props.skill.id, { instanceId, dryRun: true }),
      () => api.unlink(props.skill.id, { instanceId, dryRun: false }),
      'Remove this symlink'
    );
  };

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        Each row is one agent on this machine. The conditions column says when that agent can actually see this skill.
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 170 }}>Agent</th>
            <th style={{ width: 110 }}>State</th>
            <th>When it applies</th>
            <th style={{ width: 150 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {props.cells.map((cell) => {
            const unlinkable =
              cell.state !== 'not-linked' && cell.state !== 'n-a' && cell.instanceId.length > 0;
            let isSymlinkCopy = false;
            for (const instance of props.skill.instances) {
              if (instance.id === cell.instanceId && instance.kind === 'symlink') {
                isSymlinkCopy = true;
              }
            }
            return (
              <tr key={cell.agentId}>
                <td>{cell.agentName}</td>
                <td>
                  <Badge tone={toneFor(cell.state)} title={explain(cell.state)}>
                    {cell.state}
                  </Badge>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {cell.conditions.length === 0 ? explain(cell.state) : null}
                  {cell.conditions.map((condition) => (
                    <div key={condition}>{condition}</div>
                  ))}
                </td>
                <td>
                  {cell.state === 'not-linked' && props.skill.scope !== 'plugin' ? (
                    <button onClick={() => link(cell.agentId)} disabled={busy}>
                      Link
                    </button>
                  ) : null}
                  {unlinkable && isSymlinkCopy ? (
                    <button onClick={() => unlink(cell.instanceId)} disabled={busy}>
                      Unlink
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {plan.length > 0 ? (
        <PlanDialog
          title={title}
          steps={plan}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => {
            setPlan([]);
            setPending(null);
          }}
        />
      ) : null}
    </div>
  );
}
