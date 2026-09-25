import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface SidebarRowProps {
  icon: ReactNode;
  label: string;
  to?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  selected?: boolean;
  muted?: boolean;
  className?: string;
  title?: string;
  onHide?: () => void;
}

export function SidebarRow({ icon, label, to, onClick, trailing, selected = false, muted = false, className = '', title, onHide }: SidebarRowProps) {
  let rowClass = `sidebar-link shell-row ${className}`;
  if (selected) {
    rowClass += ' active';
  }
  if (muted) {
    rowClass += ' is-muted';
  }
  let ariaCurrent: 'page' | false = false;
  if (selected) {
    ariaCurrent = 'page';
  }
  const content = (
    <>
      <span className="shell-row-icon" aria-hidden="true">{icon}</span>
      <span className="sidebar-link-label">{label}</span>
      <span className="shell-row-trailing">{trailing}</span>
    </>
  );
  const tooltip = title ?? label;
  let main = <button type="button" className={rowClass} title={tooltip} aria-label={label} onClick={onClick}>{content}</button>;
  if (to) {
    main = <Link className={rowClass} to={to} title={tooltip} aria-label={label} aria-current={ariaCurrent} onClick={onClick}>{content}</Link>;
  }
  if (!onHide) {
    return main;
  }
  return (
    <div className="shell-row-wrap">
      {main}
      <button type="button" className="shell-row-hide" aria-label={`Hide ${label} from sidebar`} title="Hide from sidebar" onClick={onHide}><X aria-hidden="true" /></button>
    </div>
  );
}
