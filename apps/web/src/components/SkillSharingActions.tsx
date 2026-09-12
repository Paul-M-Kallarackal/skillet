import { useState } from 'react';
import { Globe } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import type { OpResult, Skill, VisibilityCell } from '../api/client.types';
import { useIndex } from '../app/IndexProvider';
import { AgentIcon } from './AgentIcon';
import { ConfirmDialog } from './ConfirmDialog';
import { RepositoryPicker } from './RepositoryPicker';
import { Select } from './Select';
import { isCommonAgent } from './common-agents';

export function SkillSharingActions({ skill, cells }: { skill: Skill; cells: VisibilityCell[] }) {
  const { index, refresh } = useIndex();
  const [scope, setScope] = useState<'global' | 'project'>(skill.scope === 'project' ? 'project' : 'global');
  const [repoId, setRepoId] = useState(skill.repoId ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ title: string; description: string; action: string; run: () => Promise<OpResult> } | null>(null);
  const related = (index?.skills ?? [skill]).filter((entry) => entry.id === skill.id || (entry.name === skill.name && entry.instances.some((copy) => copy.contentHash && skill.instances.some((source) => source.contentHash === copy.contentHash))));
  const installations = related.flatMap((entry) => entry.instances.map((instance) => ({ ...instance, ownerSkillId: entry.id })));
  const agents = index?.agents.filter((agent) => agent.installed || agent.custom || isCommonAgent(agent.id)) ?? [];

  async function stage(title: string, description: string, operation: (dryRun: boolean) => Promise<OpResult>, action = 'Install') {
    setBusy(true); setFailure(''); setMessage('');
    try {
      await operation(true);
      setPending({ title, description, action, run: () => operation(false) });
    } catch (error) { setFailure(errorMessage(error, 'Could not prepare this change. Please try again.')); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!pending) return;
    setBusy(true); setFailure('');
    try { await pending.run(); setMessage(pending.action === 'Remove access' ? 'Access removed.' : 'Installed.'); setPending(null); refresh(); }
    catch (error) { setFailure(errorMessage(error, 'Could not complete this change. Please try again.')); }
    finally { setBusy(false); }
  }

  return <div className="sharing-controls">
    {failure && !pending ? <p className="inline-feedback" role="alert">{failure}</p> : null}
    {message ? <p className="sharing-note" role="status">{message}</p> : null}
    <div className="sharing-destination">
      <label>Use in<Select value={scope} disabled={busy} onChange={(event) => setScope(event.target.value === 'project' ? 'project' : 'global')}>
        <option value="global">All projects</option><option value="project">One project</option>
      </Select></label>
      {scope === 'project' ? <RepositoryPicker value={repoId} onChange={(repo) => setRepoId(repo.id)} /> : null}
    </div>
    <div className="agent-access"><h3>Visible to</h3><div className="sharing-agents" aria-label={`Agent access for ${skill.name}`}>
      {agents.map((agent) => {
        const cell = cells.find((entry) => entry.agentId === agent.id);
        const matching = installations.filter((entry) => (entry.readers?.includes(agent.id) || entry.id === cell?.instanceId) && (scope === 'global' ? (entry.scope ?? skill.scope) === 'global' : entry.repoId === repoId || entry.scope === 'global'));
        const instance = matching.find((entry) => entry.absPath === `${agent.resolvedGlobalDir}/${skill.name}`) ?? matching[0];
        const available = Boolean(instance);
        return <button type="button" className="agent-access-toggle" key={agent.id} aria-pressed={available} aria-label={agent.name}
          title={available ? `Manage ${agent.name} access` : `Install for ${agent.name}`}
          disabled={busy || (!available && !(scope === 'global' ? agent.resolvedGlobalDir : agent.projectDir))}
          onClick={() => {
            if (available && instance) {
              const readers = instance.readers ?? [agent.id];
              const affected = (index?.agents ?? []).filter((entry) => readers.includes(entry.id)).map((entry) => entry.name);
              const note = affected.length > 1 ? ` This folder is also read by ${affected.filter((name) => name !== agent.name).join(', ')}.` : '';
              void stage(`Remove ${agent.name} access?`, `Remove this installation?${instance.kind === 'symlink' ? ' The original skill will stay in place.' : ' You can restore this copy from Trash.'}${note}`, (dryRun) => api.removeInstallation(instance.ownerSkillId, { instanceId: instance.id, dryRun }), 'Remove access');
            } else if (scope === 'project' && !repoId) {
              setMessage('Choose a repository above, then select an agent.');
            } else {
              void stage(`Install ${skill.name} for ${agent.name}?`, `Make this skill available to ${agent.name} ${scope === 'global' ? 'across all projects' : 'in the selected project'}?`, (dryRun) => api.copy(skill.id, { target: { agentId: agent.id, scope, repoId: scope === 'project' ? repoId : '' }, mode: 'copy', dryRun }));
            }
          }}><AgentIcon id={agent.id} name={agent.name} decorative /><span>{agent.name}</span></button>;
      })}
      <button type="button" className="agent-access-toggle" disabled={busy} title="Install for every known agent across all projects" onClick={() => void stage(
        `Install ${skill.name} globally?`, 'Install for every known agent across all projects? Existing installations will be kept.', (dryRun) => api.installAll(skill.id, dryRun)
      )}><Globe size={18} aria-hidden="true" /><span>Global</span></button>
    </div></div>

    {pending ? <ConfirmDialog title={pending.title} description={pending.description} action={pending.action} busy={busy} error={failure} onConfirm={() => void confirm()} onCancel={() => { setPending(null); setFailure(''); }} /> : null}
  </div>;
}
