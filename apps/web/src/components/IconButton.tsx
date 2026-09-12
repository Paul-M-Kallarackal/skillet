import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function IconButton({ label, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <span className="icon-control">
    <button type="button" {...props} aria-label={label} className={`icon-button ${className}`}>{children}</button>
    <span className="control-tooltip" aria-hidden="true">{label}</span>
  </span>;
}
