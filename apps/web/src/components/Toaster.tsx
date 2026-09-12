import { CheckCircle2, CircleAlert } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  kind: 'ok' | 'error';
}

interface ToastContextValue {
  push: (message: string, kind: 'ok' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

const stackStyle: CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  display: 'grid',
  gap: 8,
  zIndex: 50
};

export function Toaster(props: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: 'ok' | 'error') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => {
      setToasts((current) => {
        const next: Toast[] = [];
        for (const entry of current) {
          if (entry.id !== id) {
            next.push(entry);
          }
        }
        return next;
      });
    }, 5000);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <div style={stackStyle}>
        {toasts.map((toast) => {
          const Icon = toast.kind === 'error' ? CircleAlert : CheckCircle2;
          return (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                maxWidth: 'min(460px, calc(100vw - 32px))',
                overflowWrap: 'anywhere',
                boxShadow: 'var(--ui-shadow-card)', display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <Icon aria-hidden="true" size={16} style={{ color: toast.kind === 'error' ? 'var(--red)' : 'var(--green)', flexShrink: 0 }} />{toast.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
