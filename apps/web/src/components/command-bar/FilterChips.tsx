import { useSearchParams } from 'react-router-dom';
import type { SkilletIndex } from '../../api/client.types';
import { AddFilterChip, FilterChip } from '../shell/FilterChip';
import { Popover, PopoverItem } from '../shell/Popover';
import { SCOPE_LABELS } from '../shell/skill-visibility';

export function FilterChips({ index }: { index: SkilletIndex }) {
  const [params, setParams] = useSearchParams();
  const remove = (key: string) => {
    const next = new URLSearchParams(params);
    next.delete(key);
    setParams(next);
  };
  const add = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  };
  const chips: { key: string; label: string }[] = [];
  const scope = params.get('scope') ?? '';
  if (scope.length > 0) {
    chips.push({ key: 'scope', label: SCOPE_LABELS[scope] ?? scope });
  }
  const agentId = params.get('agent') ?? '';
  for (const agent of index.agents) {
    if (agent.id === agentId) {
      chips.push({ key: 'agent', label: `Visible to ${agent.name}` });
    }
  }
  const repoId = params.get('repo') ?? '';
  for (const repo of index.repos) {
    if (repo.id === repoId) {
      chips.push({ key: 'repo', label: repo.label });
    }
  }
  if (params.get('hub') === '1') {
    chips.push({ key: 'hub', label: 'Shared hub' });
  }
  return (
    <div className="shell-chips">
      {chips.map((chip) => <FilterChip key={chip.key} label={chip.label} onRemove={() => remove(chip.key)} />)}
      <Popover placement="above" trigger={({ toggle }) => <AddFilterChip onClick={toggle} />}>
        {(close) => (
          <>
            <PopoverItem label="Global skills" onSelect={() => { close(); add('scope', 'global'); }} />
            <PopoverItem label="Project skills" onSelect={() => { close(); add('scope', 'project'); }} />
            <PopoverItem label="Plugin skills" onSelect={() => { close(); add('scope', 'plugin'); }} />
            <PopoverItem label="In the shared hub" onSelect={() => { close(); add('hub', '1'); }} />
          </>
        )}
      </Popover>
    </div>
  );
}
