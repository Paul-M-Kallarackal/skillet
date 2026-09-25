import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';

export interface PopoverTriggerProps {
  open: boolean;
  toggle: (event: ReactMouseEvent<HTMLElement>) => void;
}

type PopoverPlacement = 'below' | 'above' | 'right';

export function Popover({ trigger, children, placement = 'below' }: { trigger: (props: PopoverTriggerProps) => ReactNode; children: (close: () => void) => ReactNode; placement?: PopoverPlacement }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);

  // Fixed positioning keeps the menu out of scrollable ancestors (the sidebar) that would clip it.
  const place = (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    if (placement === 'right') {
      setPosition({ top: rect.top, left: rect.right + 8 });
      return;
    }
    if (placement === 'above') {
      setPosition({ bottom: window.innerHeight - rect.top + 6, left: rect.left });
      return;
    }
    setPosition({ top: rect.bottom + 6, left: rect.left });
  };

  const toggle = (event: ReactMouseEvent<HTMLElement>) => {
    if (!open) {
      place(event.currentTarget);
    }
    setOpen(!open);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    items()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const list = items();
        if (list.length === 0) {
          return;
        }
        event.preventDefault();
        let step = 1;
        if (event.key === 'ArrowUp') {
          step = -1;
        }
        const current = list.indexOf(document.activeElement as HTMLElement);
        list[(current + step + list.length) % list.length]?.focus();
        return;
      }
      if (event.key === 'Escape') {
        setOpen(false);
        const button = ref.current?.querySelector<HTMLElement>('[data-popover-trigger]');
        button?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="shell-popover-anchor" ref={ref}>
      {trigger({ open, toggle })}
      {open && <div className="shell-popover" style={position} role="menu">{children(close)}</div>}
    </div>
  );
}

export function PopoverItem({ icon, label, meta, onSelect }: { icon?: ReactNode; label: string; meta?: string; onSelect: () => void }) {
  return (
    <button type="button" role="menuitem" className="shell-menu-item" onClick={onSelect}>
      <span className="shell-menu-icon" aria-hidden="true">{icon}</span>
      <span className="shell-menu-label">{label}</span>
      {meta && <span className="shell-menu-meta">{meta}</span>}
    </button>
  );
}

export function PopoverDivider() {
  return <div className="shell-menu-divider" role="separator" />;
}
