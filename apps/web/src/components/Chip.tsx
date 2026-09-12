import type { ReactNode } from 'react';

export function Chip({ children, accent = false, title }: { children: ReactNode; accent?: boolean; title?: string }) {
  return <span className={`chip${accent ? ' chip-accent' : ''}`} title={title}>{children}</span>;
}
