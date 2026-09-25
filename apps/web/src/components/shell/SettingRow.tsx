import type { ReactNode } from 'react';

/** One setting: label and help on the left, its control on the right. Paper: Settings — Appearance rows. */
export function SettingRow({ title, description, children, stacked = false }: { title: string; description: string; children: ReactNode; stacked?: boolean }) {
  let className = 'shell-field-row';
  if (stacked) {
    className += ' is-stacked';
  }
  return (
    <div className={className}>
      <span className="shell-field-copy"><strong>{title}</strong><span>{description}</span></span>
      <span className="shell-field-controls">{children}</span>
    </div>
  );
}
