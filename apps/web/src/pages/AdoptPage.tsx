import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { Badge } from '../components/Badge';
import { useToast } from '../components/Toaster';
import type { AdoptDecisionInput, AdoptGroup, AdoptPlan } from '../api/client.types';

export function AdoptPage() {
  const { refresh } = useIndex();
  const toast = useToast();
  const [plan, setPlan] = useState<AdoptPlan | null>(null);
  const [winners, setWinners] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .planAdopt()
      .then((next) => {
        setPlan(next);
        const initial: Record<string, string> = {};
        for (const group of next.groups) {
          initial[group.name] = group.suggestedInstanceId;
        }
        setWinners(initial);
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'could not build an adopt plan'), 'error'));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!plan) {
    return <div>Planning...</div>;
  }

  const pending: AdoptGroup[] = [];
  for (const group of plan.groups) {
    if (!group.alreadyInHub) {
      pending.push(group);
    }
  }

  const apply = () => {
    const decisions: AdoptDecisionInput[] = [];
    for (const group of plan.groups) {
      if (group.alreadyInHub) {
        continue;
      }
      const winner = winners[group.name];
      if (!winner) {
        continue;
      }
      decisions.push({ name: group.name, winnerInstanceId: winner, linkAgents: [] });
    }
    setBusy(true);
    api
      .applyAdopt(decisions)
      .then(() => {
        refresh();
        load();
        toast.push(`Adopted ${decisions.length} skills into the hub`, 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'adopt failed'), 'error'))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-eyebrow">Canonical storage</div>
          <div className="page-title-row"><h1>Adopt into hub</h1><span className="page-count">{pending.length}</span></div>
          <p className="page-description">{`Move global skills into ${plan.hubPath}, then safely link each agent to the source of truth. Duplicate copies are backed up.`}</p>
        </div>
        <div className="page-actions">
          <Badge tone="green" title="groups whose copies are byte identical">{`${plan.identicalGroups} identical`}</Badge>
          <Badge tone="amber" title="groups whose copies differ, so you must choose">{`${plan.conflictGroups} conflicts`}</Badge>
          <Badge tone="neutral" title="groups not yet in the hub">{`${pending.length} pending`}</Badge>
        </div>
      </div>

      <div className="surface table-scroll"><table>
        <thead>
          <tr>
            <th style={{ width: '22%' }}>Skill</th>
            <th>Which copy becomes the source of truth</th>
            <th style={{ width: 110 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {plan.groups.map((group) => (
            <tr key={group.name}>
              <td>{group.name}</td>
              <td>
                {group.candidates.map((candidate) => {
                  let checked = false;
                  if (winners[group.name] === candidate.instanceId) {
                    checked = true;
                  }
                  return (
                    <label
                      key={candidate.instanceId}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        flexWrap: 'wrap'
                      }}
                    >
                      <input
                        type="radio"
                        name={`winner-${group.name}`}
                        checked={checked}
                        disabled={group.alreadyInHub || candidate.isSymlink}
                        onChange={() => setWinners({ ...winners, [group.name]: candidate.instanceId })}
                      />
                      <span>{candidate.absPath}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{candidate.contentHash}</span>
                      {candidate.isSymlink ? <span style={{ color: 'var(--text-muted)' }}>symlink</span> : null}
                    </label>
                  );
                })}
              </td>
              <td>
                {group.alreadyInHub ? (
                  <Badge tone="green" title="already adopted">
                    in hub
                  </Badge>
                ) : null}
                {group.conflict ? (
                  <Badge tone="amber" title="the copies differ, pick the one to keep">
                    conflict
                  </Badge>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <div style={{ marginTop: 20 }}>
        <button className="primary" onClick={apply} disabled={busy || pending.length === 0}>
          {`Adopt ${pending.length} skills`}
        </button>
      </div>
    </div>
  );
}
