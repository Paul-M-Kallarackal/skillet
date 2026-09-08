import { useState } from 'react';
import type { CSSProperties } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';
import { DiffView } from './DiffView';
import { PlanDialog } from './PlanDialog';
import { useToast } from './Toaster';
import type { FsStep, GitState, LinkTarget, Skill } from '../api/client.types';

const selectStyle: CSSProperties = {
  padding: '4px 8px',
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  font: 'inherit',
  maxWidth: 380
};

function gitTone(state: GitState): BadgeTone {
  if (state === 'tracked') {
    return 'green';
  }
  if (state === 'modified' || state === 'untracked') {
    return 'amber';
  }
  return 'neutral';
}

export function InstanceList(props: { skill: Skill }) {
  const { index, refresh } = useIndex();
  const toast = useToast();
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [patch, setPatch] = useState('');
  const [plan, setPlan] = useState<FsStep[]>([]);
  const [pending, setPending] = useState<(() => Promise<unknown>) | null>(null);
  const [title, setTitle] = useState('');
  const [targetRepo, setTargetRepo] = useState('');
  const [busy, setBusy] = useState(false);

  const showDiff = () => {
    setBusy(true);
    api
      .getDiff(props.skill.id, left, right)
      .then((result) => setPatch(result.patch))
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'diff failed'), 'error'))
      .finally(() => setBusy(false));
  };

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

  const moveToHub = () => {
    const target: LinkTarget = { agentId: 'hub', scope: 'global', repoId: '' };
    stage(
      () => api.move(props.skill.id, { target, keepLinkAtSource: true, dryRun: true }),
      () => api.move(props.skill.id, { target, keepLinkAtSource: true, dryRun: false }),
      'Move into the global hub and leave a link behind'
    );
  };

  const moveToRepo = () => {
    const target: LinkTarget = { agentId: 'claude-code', scope: 'project', repoId: targetRepo };
    stage(
      () => api.move(props.skill.id, { target, keepLinkAtSource: false, dryRun: true }),
      () => api.move(props.skill.id, { target, keepLinkAtSource: false, dryRun: false }),
      'Move into this repository'
    );
  };

  const copyToRepo = () => {
    const target: LinkTarget = { agentId: 'claude-code', scope: 'project', repoId: targetRepo };
    stage(
      () => api.copy(props.skill.id, { target, mode: 'copy', dryRun: true }),
      () => api.copy(props.skill.id, { target, mode: 'copy', dryRun: false }),
      'Copy into this repository as an independent copy'
    );
  };

  const repos = [];
  if (index) {
    for (const repo of index.repos) {
      repos.push(repo);
    }
  }
  const readOnly = props.skill.scope === 'plugin';

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Path</th>
            <th style={{ width: 85 }}>Kind</th>
            <th style={{ width: 130 }}>Content hash</th>
            <th style={{ width: 100 }}>Git</th>
            <th style={{ width: 160 }}>Read by</th>
          </tr>
        </thead>
        <tbody>
          {props.skill.instances.map((instance) => (
            <tr key={instance.id}>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 12, wordBreak: 'break-all' }}>
                {instance.absPath}
                {instance.kind === 'symlink' ? (
                  <div style={{ color: 'var(--text-muted)' }}>{`links to ${instance.symlinkTarget}`}</div>
                ) : null}
                {instance.isHub ? <div style={{ color: 'var(--accent)' }}>hub copy</div> : null}
              </td>
              <td>{instance.kind}</td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{instance.contentHash}</td>
              <td>
                <Badge tone={gitTone(instance.gitState)} title="git status of this path">
                  {instance.gitState}
                </Badge>
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{instance.readers.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {props.skill.instances.length > 1 ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          <select value={left} onChange={(event) => setLeft(event.target.value)} style={selectStyle}>
            <option value="">compare this copy</option>
            {props.skill.instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.absPath}
              </option>
            ))}
          </select>
          <select value={right} onChange={(event) => setRight(event.target.value)} style={selectStyle}>
            <option value="">against this one</option>
            {props.skill.instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.absPath}
              </option>
            ))}
          </select>
          <button onClick={showDiff} disabled={busy || left.length === 0 || right.length === 0}>
            Compare
          </button>
        </div>
      ) : null}

      {patch.length > 0 ? <DiffView patch={patch} /> : null}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 24, flexWrap: 'wrap' }}>
        <button onClick={moveToHub} disabled={readOnly || busy || props.skill.scope !== 'project'}>
          Move to global hub
        </button>
        <select value={targetRepo} onChange={(event) => setTargetRepo(event.target.value)} style={selectStyle}>
          <option value="">choose a repository</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.label}
            </option>
          ))}
        </select>
        <button onClick={moveToRepo} disabled={readOnly || busy || targetRepo.length === 0}>
          Move into repo
        </button>
        <button onClick={copyToRepo} disabled={busy || targetRepo.length === 0}>
          Copy into repo
        </button>
      </div>

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
