import { Hono } from 'hono';
import { loadConfig, saveConfig } from '../config/config';
import { SkilletError } from '../errors';
import { resolveAgents } from '../registry/agents';
import type { AgentDefinition } from '../registry/agents.types';

const SERVICE = 'AgentsRoute';

export const agentsRoute = new Hono();

agentsRoute.get('/', async (c) => {
  try {
    const config = await loadConfig();
    const agents = await resolveAgents(config);
    return c.json({ agents });
  } catch (error) {
    throw new SkilletError({
      message: 'failed to list agents',
      method: 'listAgents',
      service: SERVICE,
      error
    });
  }
});

agentsRoute.put('/custom', async (c) => {
  try {
    const body = (await c.req.json()) as { agent: AgentDefinition };
    const config = await loadConfig();
    const next: AgentDefinition[] = [];
    for (const existing of config.customAgents) {
      if (existing.id !== body.agent.id) {
        next.push(existing);
      }
    }
    next.push(body.agent);
    const saved = await saveConfig({ customAgents: next });
    return c.json({ config: saved });
  } catch (error) {
    throw new SkilletError({
      message: 'failed to save custom agent',
      method: 'saveCustomAgent',
      service: SERVICE,
      error
    });
  }
});
