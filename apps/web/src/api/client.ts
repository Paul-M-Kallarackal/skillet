import type {
  AdoptDecisionInput,
  AdoptPlan,
  LinkTarget,
  OpResult,
  Repo,
  SkilletConfig,
  SkilletIndex,
  SkillFrontmatter,
  TrashEntry
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
  discoverProjects(): Promise<{ repos: Repo[] }> {
    return request('/api/projects', { method: 'GET' });
  },
  addProject(path: string): Promise<{ repos: Repo[]; selectedId: string }> {
    return request('/api/projects', jsonInit('POST', { path }));
  },
  searchCatalog(query: string): Promise<{ skills: CatalogSkill[] }> {
    return request(`/api/catalog/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
  },
  previewImport(skill: CatalogSkill): Promise<ImportPreview> {
    return request('/api/catalog/preview', jsonInit('POST', skill));
  },
  installImport(token: string): Promise<{ skillId: string; destination: string; name: string }> {
    return request('/api/catalog/install', jsonInit('POST', { token }));
  },
  getIndex(): Promise<SkilletIndex> {
    return request<SkilletIndex>('/api/index', { method: 'GET' });
  },
  rescan(): Promise<SkilletIndex> {
    return request<SkilletIndex>('/api/rescan', mutateInit('POST'));
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
  removeInstallation(id: string, payload: { instanceId: string; dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/remove-installation`, jsonInit('POST', payload));
  },
  installAll(id: string, dryRun: boolean): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/install-all`, jsonInit('POST', { dryRun }));
  },
  copy(id: string, payload: { target: LinkTarget; mode: 'link' | 'copy'; dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/copy`, jsonInit('POST', payload));
  },
  trash(id: string, payload: { dryRun: boolean; instanceId?: string }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/trash`, jsonInit('POST', payload));
  },
  setInvocation(id: string, payload: { automatic: boolean; dryRun: boolean }): Promise<OpResult> {
    return request<OpResult>(`/api/skills/${encodeURIComponent(id)}/invocation`, jsonInit('POST', payload));
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

export interface CatalogSkill { source: string; slug: string; name: string }
export interface ImportPreview extends CatalogSkill {
  token: string; description: string; instructions: string; files: string[];
  destination: string; commit: string; existing: boolean;
}

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
