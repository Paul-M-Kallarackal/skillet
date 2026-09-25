import { CornerDownLeft, Folder } from 'lucide-react';
import { AgentIcon } from '../AgentIcon';
import type { MenuOption } from './command-bar.types';

function OptionIcon({ option }: { option: MenuOption }) {
  if (option.icon === 'agent') {
    return <span className="shell-menu-tile"><AgentIcon id={option.id} name={option.label} decorative /></span>;
  }
  if (option.icon === 'folder') {
    return <span className="shell-menu-tile"><Folder aria-hidden="true" /></span>;
  }
  if (option.icon === 'command') {
    return <span className="shell-menu-slash" aria-hidden="true">/</span>;
  }
  return null;
}

export function CommandMenu({ title, meta, options, activeIndex, onPick, footerStart, footerEnd }: {
  title: string; meta: string; options: MenuOption[]; activeIndex: number; onPick: (option: MenuOption) => void; footerStart: string[]; footerEnd: string;
}) {
  return (
    <div className="shell-command-menu" role="listbox" aria-label={title}>
      <div className="shell-command-menu-head"><span>{title}</span><span>{meta}</span></div>
      {options.map((option, position) => {
        let className = 'shell-menu-item';
        const active = position === activeIndex;
        if (active) {
          className += ' is-active';
        }
        let muted = '';
        if (option.meta === 'Already linked') {
          muted = ' is-muted';
        }
        return (
          <button type="button" role="option" aria-selected={active} key={`${option.id}-${position}`} className={className + muted} onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(option)}>
            <OptionIcon option={option} />
            <span className="shell-menu-label">{option.label}</span>
            <span className="shell-menu-meta">{option.meta}</span>
            <span className="shell-menu-enter" aria-hidden="true">{active && <CornerDownLeft />}</span>
          </button>
        );
      })}
      {options.length === 0 && <p className="shell-command-empty">No matches.</p>}
      <div className="shell-command-menu-foot">
        {footerStart.map((hint) => <span key={hint}>{hint}</span>)}
        {footerEnd.length > 0 && <span className="shell-command-menu-foot-end">{footerEnd}</span>}
      </div>
    </div>
  );
}
