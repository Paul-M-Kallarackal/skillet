import { Hono } from 'hono';
import { editContent, renameSkill } from '../hub/content';
import { diffInstances } from '../hub/diff';
import { copySkill, linkSkill, moveSkill, unlinkInstance } from '../hub/linking';
import type { LinkTarget } from '../hub/linking';
import type { OpResult } from '../hub/steps.types';
import { trashSkill } from '../hub/trash';
import { setTrigger } from '../hub/trigger';
import type { TriggerChanges } from '../hub/trigger';
import { SkilletError } from '../errors';
import type { SkillFrontmatter } from '../scan/frontmatter.types';
import { getIndex, scanAll } from '../scan/scanner';

const SERVICE = 'SkillsRoute';

export const skillsRoute = new Hono();

async function finish(result: OpResult): Promise<OpResult> {
  if (result.applied) {
    await scanAll();
  }
  return result;
}

function wrap(method: string, error: unknown): never {
  if (error instanceof SkilletError) {
    throw error;
  }
  throw new SkilletError({ message: `${method} failed`, method, service: SERVICE, error });
}

skillsRoute.get('/:id', (c) => {
  const id = decodeURIComponent(c.req.param('id'));
  const index = getIndex();
  for (const skill of index.skills) {
    if (skill.id === id) {
      let cells = index.cells[id];
      if (!cells) {
        cells = [];
      }
      return c.json({ skill, cells });
    }
  }
  return c.json({ code: 'NOT_FOUND', message: `skill not found: ${id}` }, 404);
});

skillsRoute.get('/:id/diff', (c) => {
  const id = decodeURIComponent(c.req.param('id'));
  let a = c.req.query('a');
  let b = c.req.query('b');
  if (!a) {
    a = '';
  }
  if (!b) {
    b = '';
  }
  return c.json({ patch: diffInstances(id, a, b) });
});

skillsRoute.put('/:id/content', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    const body = (await c.req.json()) as {
      instanceId: string;
      frontmatter: SkillFrontmatter;
      body: string;
      dryRun: boolean;
    };
    const result = await editContent({ skillId: id, ...body });
    return c.json(await finish(result));
  } catch (error) {
    wrap('editContent', error);
  }
});

skillsRoute.post('/:id/rename', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    const body = (await c.req.json()) as { newName: string; dryRun: boolean };
    const result = await renameSkill({ skillId: id, ...body });
    return c.json(await finish(result));
  } catch (error) {
    wrap('renameSkill', error);
  }
});

skillsRoute.post('/:id/link', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    const body = (await c.req.json()) as { target: LinkTarget; dryRun: boolean };
    const result = await linkSkill({ skillId: id, ...body });
    return c.json(await finish(result));
  } catch (error) {
    wrap('linkSkill', error);
  }
});

skillsRoute.post('/:id/unlink', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    const body = (await c.req.json()) as { instanceId: string; dryRun: boolean };
    const result = await unlinkInstance({ skillId: id, ...body });
    return c.json(await finish(result));
  } catch (error) {
    wrap('unlinkInstance', error);
  }
});

skillsRoute.post('/:id/copy', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    const body = (await c.req.json()) as { target: LinkTarget; mode: 'link' | 'copy'; dryRun: boolean };
    const result = await copySkill({ skillId: id, ...body });
    return c.json(await finish(result));
  } catch (error) {
    wrap('copySkill', error);
  }
});

skillsRoute.post('/:id/move', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    const body = (await c.req.json()) as { target: LinkTarget; keepLinkAtSource: boolean; dryRun: boolean };
    const result = await moveSkill({ skillId: id, ...body });
    return c.json(await finish(result));
  } catch (error) {
    wrap('moveSkill', error);
  }
});

skillsRoute.post('/:id/trash', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    const body = (await c.req.json()) as { dryRun: boolean };
    const result = await trashSkill({ skillId: id, dryRun: body.dryRun });
    return c.json(await finish(result));
  } catch (error) {
    wrap('trashSkill', error);
  }
});

skillsRoute.post('/:id/trigger', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    const body = (await c.req.json()) as { agentId: string; changes: TriggerChanges; dryRun: boolean };
    const result = await setTrigger({ skillId: id, ...body });
    return c.json(await finish(result));
  } catch (error) {
    wrap('setTrigger', error);
  }
});
