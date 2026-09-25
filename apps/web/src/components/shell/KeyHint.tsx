import type { ReactNode } from 'react';

export function KeyHint({ children }: { children: ReactNode }) {
  return <kbd className="shell-kbd">{children}</kbd>;
}
