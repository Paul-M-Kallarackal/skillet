import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

/** Native keyboard and mobile picker behavior, with consistent shared spacing. */
export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="ui-select">
    <select {...props} className={`ui-select-control ${className}`}>{children}</select>
    <ChevronDown className="ui-select-chevron" aria-hidden="true" />
  </span>;
}
