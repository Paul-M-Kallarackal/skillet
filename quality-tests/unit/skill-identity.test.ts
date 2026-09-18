import { afterEach, beforeEach, expect, it } from 'bun:test';
import { chmod, cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildInstance } from '../../apps/server/src/scan/walk';
import { buildSkills } from '../../apps/server/src/scan/index-builder';
import { computeCells } from '../../apps/server/src/visibility/visibility';
import type { BuildInstanceInput } from '../../apps/server/src/scan/walk.types';
import type { Agent } from '../../apps/server/src/registry/agents.types';

let root: string;
const raw = '---\nname: code-review\ndescription: Review code\n---\nRead scripts/check.sh and references/guide.md.\n';
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'skillet-identity-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
async function create(location: string) {
  const dir = join(root, location, 'code-review');
  await mkdir(join(dir, 'scripts'), { recursive: true });
  await mkdir(join(dir, 'references'), { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), raw);
  await writeFile(join(dir, 'scripts/check.sh'), 'echo check\n');
  await writeFile(join(dir, 'references/guide.md'), 'Review carefully\n');
  return dir;
}
async function scan(dir: string, options: Partial<BuildInstanceInput> = {}) {
  return buildInstance({ ref: { name: 'code-review', absPath: dir, isSymlink: false, symlinkTarget: '' }, scope: 'global', readers: ['claude-code'], repoId: '', nestedDir: '', isHub: false, pluginName: '', pluginVersion: '', ...options });
}

it('counts identical global, project and plugin copies as one skill with every installation', async () => {
  const dirs = await Promise.all(['global', 'project-a', 'project-b', 'plugin'].map(create));
  const instances = await Promise.all(dirs.map((dir, i) => scan(dir, { scope: i === 0 ? 'global' : i === 3 ? 'plugin' : 'project', repoId: i === 1 || i === 2 ? dirname(dir) : '', pluginName: i === 3 ? 'package' : '', readers: i === 0 ? ['codex'] : ['claude-code'] })));
  const skills = buildSkills(instances, []);
  expect(skills).toHaveLength(1);
  expect(skills[0]!.instances).toHaveLength(4);
  expect(skills[0]!.canonicalId).toBe(dirs[0]);
  expect(skills[0]!.instances.map((instance) => instance.scope)).toEqual(['global', 'project', 'project', 'plugin']);
  expect(buildSkills([...instances].reverse(), [])).toEqual(skills);
});

it('groups project-only duplicates across repositories and separates them when a resource changes', async () => {
  const a = await create('project-a');
  const b = await create('project-b');
  const read = () => Promise.all([a, b].map((dir) => scan(dir, { scope: 'project', repoId: dirname(dir) })));
  expect(buildSkills(await read(), [])).toHaveLength(1);
  await writeFile(join(b, 'scripts/check.sh'), 'echo other\n');
  const separate = buildSkills(await read(), []);
  expect(separate).toHaveLength(2);
  expect(separate.every((skill) => skill.diverged)).toBe(true);
  await writeFile(join(b, 'scripts/check.sh'), 'echo check\n');
  expect(buildSkills(await read(), [])).toHaveLength(1);
});

it('compares all file bytes, executable permissions and resource paths, not only SKILL.md', async () => {
  const a = await create('first');
  const b = await create('second');
  const original = await scan(a);
  await writeFile(join(b, 'references/guide.md'), 'Different reference\n');
  expect((await scan(b)).contentHash).not.toBe(original.contentHash);
  await writeFile(join(b, 'references/guide.md'), 'Review carefully\n');
  await chmod(join(b, 'scripts/check.sh'), 0o755);
  expect((await scan(b)).contentHash).not.toBe(original.contentHash);
  await chmod(join(b, 'scripts/check.sh'), 0o644);
  await writeFile(join(b, 'extra.txt'), 'extra');
  expect((await scan(b)).contentHash).not.toBe(original.contentHash);
});

it('merges dereferenced copies and symlinks while ignoring import provenance', async () => {
  const a = await create('source');
  const b = join(root, 'copied/code-review');
  await cp(a, b, { recursive: true, dereference: true });
  await writeFile(join(a, '.skillet-source.json'), '{"importedAt":"yesterday"}');
  const link = join(root, 'linked/code-review');
  await mkdir(dirname(link));
  await symlink(a, link);
  const instances = await Promise.all([scan(a, { isHub: true }), scan(b), scan(link, { ref: { name: 'code-review', absPath: link, isSymlink: true, symlinkTarget: a } })]);
  expect(buildSkills(instances, [])).toHaveLength(1);
  expect(instances[2]!.kind).toBe('symlink');
});

it('does not merge unreadable resources or cyclic links', async () => {
  const dirs = await Promise.all(['first', 'second'].map(create));
  for (const dir of dirs) await symlink(dir, join(dir, 'cycle'));
  const instances = await Promise.all(dirs.map((dir) => scan(dir)));
  expect(instances.every((instance) => instance.contentHash === '')).toBe(true);
  expect(buildSkills(instances, [])).toHaveLength(2);
});

it('keeps per-installation permissions and project conditions for the same agent', async () => {
  const global = await scan(await create('global'));
  const project = await scan(await create('project'), { scope: 'project', repoId: '/repo' });
  const skill = buildSkills([global, project], [])[0]!;
  const agent: Agent = { id: 'claude-code', name: 'Claude Code', globalDir: '', projectDir: '.claude/skills', detect: [], overrideSource: 'claude', legacyGlobalDirs: [], legacyProjectDirs: [], resolvedGlobalDir: '', resolvedLegacyGlobalDirs: [], installed: true, custom: false };
  const cells = computeCells(skill, [agent], [], { claudeGlobal: { 'code-review': 'off' }, claudeByRepo: { '/repo': { 'code-review': 'on' } }, codexDisabled: [] }, false);
  expect(cells.find((cell) => cell.instanceId === global.id)?.state).toBe('off');
  const projectCell = cells.find((cell) => cell.instanceId === project.id);
  expect(projectCell?.state).toBe('auto');
  expect(projectCell?.conditions).toContain('cwd inside repo');
});

it('keeps distinct global versions addressable and stable when unrelated copies are scanned', async () => {
  const a = await create('first');
  const b = await create('second');
  await writeFile(join(b, 'SKILL.md'), raw + 'Another instruction.\n');
  const instances = await Promise.all([scan(a), scan(b)]);
  const skills = buildSkills(instances, []);
  expect(new Set(skills.map((skill) => skill.id)).size).toBe(2);
  expect(buildSkills([instances[0]!], [])[0]!.id).toBe(skills.find((skill) => skill.canonicalId === a)!.id);
});
