import { useCallback, useRef, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import type { SkilletConfig } from '../../api/client.types';
import { useToast } from '../../components/Toaster';

export type SaveStatus = 'idle' | 'saving' | 'saved';

const AUTOSAVE_DELAY_MS = 600;

/** Batches edits and saves them shortly after the last change; scan-affecting keys make the server rescan. */
export function useSettingsAutosave(onSaved: () => void) {
  const toast = useToast();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const pending = useRef<Partial<SkilletConfig>>({});
  const timer = useRef(0);

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    setStatus('saving');
    try {
      await api.putConfig(patch);
      setStatus('saved');
      onSaved();
    } catch (cause) {
      setStatus('idle');
      toast.push(errorMessage(cause, 'could not save settings'), 'error');
    }
  }, [onSaved, toast]);

  const schedule = useCallback((patch: Partial<SkilletConfig>) => {
    pending.current = { ...pending.current, ...patch };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void flush();
    }, AUTOSAVE_DELAY_MS);
  }, [flush]);

  return { schedule, status };
}
