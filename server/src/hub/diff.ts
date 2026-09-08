import { createTwoFilesPatch } from 'diff';
import { SkilletError } from '../errors';
import { serialiseSkillFile } from '../scan/frontmatter';
import { getIndex } from '../scan/scanner';
import type { SkillInstance } from '../scan/walk.types';

const SERVICE = 'DiffService';

function pick(skillId: string, instanceId: string): SkillInstance {
  const index = getIndex();
  for (const skill of index.skills) {
    if (skill.id !== skillId) {
      continue;
    }
    for (const instance of skill.instances) {
      if (instance.id === instanceId) {
        return instance;
      }
    }
  }
  throw new SkilletError({
    message: `instance not found: ${instanceId}`,
    method: 'pick',
    service: SERVICE,
    error: null,
    code: 'NOT_FOUND',
    status: 404
  });
}

export function diffInstances(skillId: string, aId: string, bId: string): string {
  const a = pick(skillId, aId);
  const b = pick(skillId, bId);
  const aText = serialiseSkillFile(a.frontmatter, a.body);
  const bText = serialiseSkillFile(b.frontmatter, b.body);
  return createTwoFilesPatch(a.absPath, b.absPath, aText, bText, '', '', { context: 3 });
}
