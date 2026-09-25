import { useState } from 'react';
import type { Agent, Skill, VisibilityCell } from '../../api/client.types';
import { Dialog } from '../Dialog';
import { SkillSharingActions } from '../SkillSharingActions';
import { api } from '../../api/client';
import { SkillRow } from './SkillRow';
import { usePlannedAction } from './usePlannedAction';

export function SkillList({ skills, agents, cells, emptyMessage, highlight }: { skills: Skill[]; agents: Agent[]; cells: Record<string, VisibilityCell[]>; emptyMessage: string; highlight: string }) {
  const [managedId, setManagedId] = useState('');
  const planned = usePlannedAction();
  const trash = (skill: Skill) => {
    void planned.start(`Move ${skill.name} to Trash?`, (dryRun) => api.trash(skill.id, { dryRun }), `Moved ${skill.name} to Trash. Restore it from Trash or type /undo.`, { confirmLabel: 'Move to Trash', note: 'Agents stop seeing this skill. Restore it any time from Trash, or type /undo.' });
  };
  let managed: Skill | null = null;
  for (const skill of skills) {
    if (skill.id === managedId) {
      managed = skill;
    }
  }
  return (
    <>
      <div className="shell-skill-list">
        {skills.map((skill) => <SkillRow key={skill.id} skill={skill} agents={agents} cells={cells[skill.id] ?? []} highlight={highlight} onManage={() => setManagedId(skill.id)} onTrash={() => trash(skill)} />)}
        {skills.length === 0 && <p className="empty-state" role="status">{emptyMessage}</p>}
      </div>
      {planned.dialog}
      {managed && (
        <Dialog title={`Manage ${managed.name}`} onClose={() => setManagedId('')}>
          <SkillSharingActions skill={managed} cells={cells[managed.id] ?? []} />
        </Dialog>
      )}
    </>
  );
}
