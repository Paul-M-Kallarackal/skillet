import { describe, expect, it } from 'bun:test';
import { parseSkillFile, serialiseSkillFile } from '../../apps/server/src/scan/frontmatter';

describe('skill frontmatter', () => {
  it('parses valid metadata and preserves the body', () => {
    const parsed = parseSkillFile('---\nname: demo-skill\ndescription: A useful skill\n---\n\n# Demo\n', 'demo-skill');

    expect(parsed.errors).toEqual([]);
    expect(parsed.frontmatter.name).toBe('demo-skill');
    expect(parsed.frontmatter.description).toBe('A useful skill');
    expect(parsed.body).toBe('# Demo\n');
  });

  it('reports a name that does not match its directory', () => {
    const parsed = parseSkillFile('---\nname: wrong-name\ndescription: A useful skill\n---\n', 'demo-skill');

    expect(parsed.errors).toContainEqual({
      code: 'NAME_DIR_MISMATCH',
      message: 'name "wrong-name" does not match directory "demo-skill"',
      severity: 'error'
    });
  });

  it('serialises a parsed skill into valid frontmatter', () => {
    const parsed = parseSkillFile('---\nname: demo-skill\ndescription: A useful skill\n---\n\n# Demo\n', 'demo-skill');
    const result = serialiseSkillFile(parsed.frontmatter, parsed.body);
    const reparsed = parseSkillFile(result, 'demo-skill');

    expect(result).toContain('name: demo-skill');
    expect(result).toContain('description: A useful skill');
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.body.trimEnd()).toBe('# Demo');
  });
});
