import { useRef, useState } from 'react';
import { SegmentedControl } from './SegmentedControl';
import { api, errorMessage } from '../api/client';
import type { Skill } from '../api/client.types';

export function TriggerPanel({ skill, onChange }: { skill: Skill; onChange: (automatic: boolean) => void }) {
  const [automatic, setAutomatic] = useState(!skill.instances.some((entry) => entry.frontmatter.disableModelInvocation || entry.codexImplicitAllowed === false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const desired = useRef(automatic);
  const confirmed = useRef(automatic);
  const saving = useRef(false);
  async function change(next: boolean) {
    desired.current = next;
    setAutomatic(next);
    setError('');
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      while (desired.current !== confirmed.current) {
        const value = desired.current;
        try {
          await api.setInvocation(skill.id, { automatic: value, dryRun: false });
          confirmed.current = value;
          onChange(value);
        } catch (cause) {
          if (desired.current === value) {
            desired.current = confirmed.current;
            setAutomatic(confirmed.current);
            setError(errorMessage(cause, 'Could not save this setting.'));
            break;
          }
        }
      }
    } finally { saving.current = false; setBusy(false); }
  }
  return <div className="skill-usage">
    <div className="skill-usage-row">
      <span id="skill-usage-label">Use this skill<span className="usage-save-status" role="status">{busy ? 'Saving…' : ''}</span></span>
      <SegmentedControl label="Use this skill" value={automatic ? 'always' : 'manual'} options={[{ value: 'always', label: 'Always' }, { value: 'manual', label: 'Only when I ask' }]} disabled={skill.scope === 'plugin'} onChange={(value) => void change(value === 'always')} />
    </div>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
