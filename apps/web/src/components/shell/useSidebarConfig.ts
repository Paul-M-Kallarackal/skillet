import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import { useToast } from '../Toaster';

export interface SidebarPatch {
  sidebarAgents?: string[] | null;
  sidebarRepos?: string[] | null;
}

export function useSidebarConfig() {
  const toast = useToast();
  const [agentIds, setAgentIds] = useState<string[] | null>(null);
  const [repoIds, setRepoIds] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .getConfig()
      .then((result) => {
        setAgentIds(result.config.sidebarAgents);
        setRepoIds(result.config.sidebarRepos);
        setLoaded(true);
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'could not load sidebar settings'), 'error'));
  }, [toast]);

  const save = useCallback(async (patch: SidebarPatch): Promise<boolean> => {
    setSaving(true);
    try {
      const result = await api.putConfig(patch);
      setAgentIds(result.config.sidebarAgents);
      setRepoIds(result.config.sidebarRepos);
      setLoaded(true);
      return true;
    } catch (cause) {
      toast.push(errorMessage(cause, 'could not save sidebar'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [toast]);

  return { agentIds, repoIds, save, saving, loaded };
}
