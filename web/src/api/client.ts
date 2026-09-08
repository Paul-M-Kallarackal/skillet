import type {
  AdoptDecisionInput,
  AdoptPlan,
  JournalEntry,
  LinkTarget,
  OpResult,
  Skill,
  SkilletConfig,
  SkilletIndex,
  SkillFrontmatter,
  TrashEntry,
  TriggerChanges,
  VisibilityCell
} from './client.types';

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) {
        message = parsed.message;
      }
    } catch {
      message = text;
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

const CLIENT_HEADERS = { 'x-skillet-client': 'skillet-web' };

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json', ...CLIENT_HEADERS },
    body: JSON.stringify(body)
  };
}

function mutateInit(method: string): RequestInit {
  return { method, headers: { ...CLIENT_HEADERS } };
}

export const api = {
  getIndex(): Promise<SkilletIndex> {
    return request<SkilletIndex>('/api/index', { method: 'GET' });
  },
  rescan(): Promise<SkilletIndex> {
    return request<SkilletIndex>('/api/rescan', mutateInit('POST'));
  },
  getSkill(id: string): Promise<{ skill: Skill; cells: VisibilityCell[] }> {
    return request(`/api/skills/${encodeURIComponent(id)}`, { method: 'GET' });
  },
  putContent(
    id: string,
    payload: { instanceId: string; frontmatter: SkillFrontmatter; body: string; dryRun: boolean }
  ): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/content`, jsonInit('PUT', payload));
  },
  rename(id: string, payload: { newName: string; dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/rename`, jsonInit('POST', payload));
  },
  link(id: string, payload: { target: LinkTarget; dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/link`, jsonInit('POST', payload));
  },
  unlink(id: string, payload: { instanceId: string; dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/unlink`, jsonInit('POST', payload));
  },
  copy(id: string, payload: { target: LinkTarget; mode: 'link' | 'copy'; dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/copy`, jsonInit('POST', payload));
  },
  move(id: string, payload: { target: LinkTarget; keepLinkAtSource: boolean; dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/move`, jsonInit('POST', payload));
  },
  trash(id: string, payload: { dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/trash`, jsonInit('POST', payload));
  },
  trigger(id: string, payload: { agentId: string; changes: TriggerChanges; dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/trigger`, jsonInit('POST', payload));
  },
  getDiff(id: string, a: string, b: string): Promise<{ patch: string }> {
    const query = `a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
    return request(`/api/skills/${encodeURIComponent(id)}/diff?${query}`, { method: 'GET' });
  },
  getTrash(): Promise<{ entries: TrashEntry[] }> {
    return request('/api/trash', { method: 'GET' });
  },
  restoreTrash(entryId: string): Promise<OpResult> {
    return request<OpResult>(`/api/trash/${encodeURIComponent(entryId)}/restore`, mutateInit('POST'));
  },
  purgeTrash(entryId: string): Promise<OpResult> {
    return request<OpResult>(`/api/trash/${encodeURIComponent(entryId)}`, mutateInit('DELETE'));
  },
  getJournal(): Promise<{ entries: JournalEntry[] }> {
    return request('/api/journal', { method: 'GET' });
  },
  undo(): Promise<{ entry: JournalEntry }> {
    return request('/api/journal/undo', mutateInit('POST'));
  },
  getConfig(): Promise<{ config: SkilletConfig }> {
    return request('/api/config', { method: 'GET' });
  },
  putConfig(patch: Partial<SkilletConfig>): Promise<{ config: SkilletConfig }> {
    return request('/api/config', jsonInit('PUT', { patch }));
  },
  planAdopt(): Promise<AdoptPlan> {
    return request<AdoptPlan>('/api/adopt/plan', mutateInit('POST'));
  },
  applyAdopt(decisions: AdoptDecisionInput[]): Promise<{ result: OpResult }> {
    return request('/api/adopt/apply', jsonInit('POST', { decisions }));
  }
};

export function subscribeToEvents(onEvent: (name: string) => void): () => void {
  const source = new EventSource('/api/events');
  const handler = () => {
    onEvent('index');
  };
  source.addEventListener('index', handler);
  return () => {
    source.removeEventListener('index', handler);
    source.close();
  };
}

export function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }
  return fallback;
}
