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
          let border = 'var(--green)';
          if (toast.kind === 'error') {
            border = 'var(--red)';
          }
          return (
            <div
              key={toast.id}
              style={{
                background: 'var(--bg-subtle)',
                border: `1px solid ${border}`,
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                maxWidth: 460,
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
              }}
            >
              {toast.message}
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
