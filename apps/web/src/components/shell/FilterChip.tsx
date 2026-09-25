import { Plus, X } from 'lucide-react';
import type { MouseEvent } from 'react';

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="shell-chip">
      {label}
      <button type="button" className="shell-chip-remove" aria-label={`Remove filter ${label}`} onClick={onRemove}><X aria-hidden="true" /></button>
    </span>
  );
}

export function AddFilterChip({ onClick }: { onClick: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button type="button" className="shell-chip shell-chip-add" onClick={onClick}>
      <Plus aria-hidden="true" />Filter
    </button>
  );
}
