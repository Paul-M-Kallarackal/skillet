import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, errorMessage, subscribeToEvents } from '../api/client';
import type { SkilletIndex } from '../api/client.types';

interface IndexContextValue {
  index: SkilletIndex | null;
  loading: boolean;
  error: string;
  refresh: () => void;
}

/** Background rescan cadence while the app is visible. */
const RESCAN_INTERVAL_MS = 10_000;

/** Keeps whichever index was scanned last, so a slow background scan cannot overwrite a newer one. */
function latestIndex(previous: SkilletIndex | null, next: SkilletIndex): SkilletIndex {
  if (previous && previous.scannedAt > next.scannedAt) {
    return previous;
  }
  return next;
}

const IndexContext = createContext<IndexContextValue>({
  index: null,
  loading: true,
  error: '',
  refresh: () => {}
});

export function IndexProvider(props: { children: ReactNode }) {
  const [index, setIndex] = useState<SkilletIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .getIndex()
      .then((next) => {
        setIndex((previous) => latestIndex(previous, next));
        setError('');
      })
      .catch((cause: unknown) => {
        setError(errorMessage(cause, 'failed to load index'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const scanning = useRef(false);
  const rescan = useCallback(() => {
    if (scanning.current || document.visibilityState === 'hidden') {
      return;
    }
    scanning.current = true;
    api
      .rescan()
      .then((next) => {
        setIndex((previous) => latestIndex(previous, next));
        setError('');
      })
      .catch((cause: unknown) => {
        setError(errorMessage(cause, 'rescan failed'));
      })
      .finally(() => {
        scanning.current = false;
      });
  }, []);

  // Show the cached index right away, then rescan on open and every 10 seconds while the tab is visible.
  useEffect(() => {
    load();
    rescan();
    const timer = window.setInterval(rescan, RESCAN_INTERVAL_MS);
    document.addEventListener('visibilitychange', rescan);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', rescan);
    };
  }, [load, rescan]);

  useEffect(() => {
    const unsubscribe = subscribeToEvents((name) => {
      if (name === 'index') {
        load();
      }
    });
    return unsubscribe;
  }, [load]);

  const value = useMemo<IndexContextValue>(
    () => ({ index, loading, error, refresh: load }),
    [index, loading, error, load]
  );

  return <IndexContext.Provider value={value}>{props.children}</IndexContext.Provider>;
}

export function useIndex(): IndexContextValue {
  return useContext(IndexContext);
}
