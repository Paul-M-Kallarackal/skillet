import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, errorMessage, subscribeToEvents } from '../api/client';
import type { SkilletIndex } from '../api/client.types';

interface IndexContextValue {
  index: SkilletIndex | null;
  loading: boolean;
  error: string;
  refresh: () => void;
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
        setIndex(next);
        setError('');
      })
      .catch((cause: unknown) => {
        setError(errorMessage(cause, 'failed to load index'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
