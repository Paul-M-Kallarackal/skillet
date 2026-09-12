import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile, realpath, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SkilletIndex, Skill } from '../../apps/server/src/scan/index.types';
import type { Agent } from '../../apps/server/src/registry/agents.types';
import type { FsStep } from '../../apps/server/src/hub/steps.types';
import { parseSkillFile } from '../../apps/server/src/scan/frontmatter';
import { parseSettings } from '../../apps/server/src/hub/agent-settings';

const state = vi.hoisted(() => ({ root: '', index: {} as SkilletIndex, inverse: [] as FsStep[] }));
vi.mock('../../apps/server/src/config/config.constants', () => ({ get TRASH_PATH() { return join(state.root, 'trash'); } }));
vi.mock('../../apps/server/src/scan/scanner', () => ({ getIndex: () => state.index }));
vi.mock('../../apps/server/src/hub/journal', () => ({ appendEntry: async (_entry: unknown, inverse: FsStep[]) => { state.inverse = inverse; return { id: 'fixture-operation' }; } }));
vi.mock('../../apps/server/src/config/config', () => ({ loadConfig: async () => ({ hubPath: join(state.root, 'hub'), projectRoots: [state.root], customAgents: [] }) }));
vi.mock('../../apps/server/src/registry/agents', async (original) => {
  const actual = await original<typeof import('../../apps/server/src/registry/agents')>();
  return { ...actual, resolveAgents: async () => state.index.agents, expandPath: (raw: string) => raw.replace('$CODEX_HOME', join(state.root, 'codex')).replace('$CLAUDE_CONFIG_DIR', join(state.root, 'claude-code')).replace('$XDG_CONFIG_HOME', state.root) };
});
import { setSkillInvocation, setTrigger, type TriggerChanges } from '../../apps/server/src/hub/trigger';
import { copySkill, installEverywhere, linkSkill } from '../../apps/server/src/hub/linking';
import { trashSkill } from '../../apps/server/src/hub/trash';
import { renameSkill } from '../../apps/server/src/hub/content';
import { applySteps } from '../../apps/server/src/hub/steps';

const ids = ['codex','claude-code','pi','opencode','cursor'];
const raw = '---\nname: demo\ndescription: Use for a demo\n---\n\nRead references/guide.md and run scripts/task.sh.\n';
const defaults: TriggerChanges = { disableModelInvocation: false, userInvocable: true, paths: [], claudeOverride: '', claudeOverrideScope: 'global', codexEnabled: true };
let skill: Skill;
beforeEach(async () => {
  state.root = await mkdtemp(join(tmpdir(), 'skillet-agent-contract-'));
  const source = join(state.root, 'hub', 'demo');
  await mkdir(join(source, 'references'), { recursive: true });
  await mkdir(join(source, 'scripts'), { recursive: true });
  await writeFile(join(source, 'SKILL.md'), raw);
  await writeFile(join(source, 'references', 'guide.md'), 'Keep this reference');
  await writeFile(join(source, 'scripts', 'task.sh'), '#!/bin/sh\nexit 0\n');
  skill = { id: 'global:demo', name: 'demo', scope: 'global', repoId: '', repoName: '', canonicalId: source, description: 'Demo', diverged: false, shadowed: false, pluginName: '', errors: [], instances: [{ id: source, name: 'demo', absPath: source, parentDir: join(state.root, 'hub'), kind: 'canonical', scope: 'global', readers: ids, repoId: '', nestedDir: '', symlinkTarget: '', contentHash: '', frontmatter: parseSkillFile(raw, 'demo').frontmatter, body: 'Read references/guide.md and run scripts/task.sh.', files: ['SKILL.md','references/guide.md','scripts/task.sh'], gitState: 'none', errors: [], pluginName: '', pluginVersion: '', isHub: true }] };
  const agents: Agent[] = ids.map((id) => ({ id, name: id, globalDir: join(state.root, id, 'skills'), resolvedGlobalDir: join(state.root, id, 'skills'), projectDir: `.${id}/skills`, detect: [], overrideSource: 'none', legacyGlobalDirs: [], legacyProjectDirs: [], resolvedLegacyGlobalDirs: [], installed: true, custom: false }));
  state.index = { agents, skills: [skill], repos: [], cells: {}, hubPath: join(state.root, 'hub'), scannedAt: '', scanMs: 0, stalePluginVersions: 0 };
  state.inverse = [];
});
afterEach(async () => { await rm(state.root, { recursive: true, force: true }); });

it.each(ids)('copies a complete skill to %s only on apply, with undo', async (agentId) => {
  const target = { agentId, scope: 'global' as const, repoId: '' };
  const destination = join(state.root, agentId, 'skills', 'demo');
  const preview = await copySkill({ skillId: skill.id, target, mode: 'copy', dryRun: true });
  expect(preview.applied).toBe(false);
  await expect(readFile(join(destination, 'SKILL.md'))).rejects.toThrow();
  await copySkill({ skillId: skill.id, target, mode: 'copy', dryRun: false });
  expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toBe(raw);
  expect(await readFile(join(destination, 'references/guide.md'), 'utf8')).toBe('Keep this reference');
  expect(await readFile(join(destination, 'scripts/task.sh'), 'utf8')).toContain('exit 0');
  await applySteps(state.inverse);
  await expect(readFile(join(destination, 'SKILL.md'))).rejects.toThrow();
  expect(await readFile(join(skill.canonicalId, 'SKILL.md'), 'utf8')).toBe(raw);
});

it.each(ids)('links a skill to %s without losing its resources', async (agentId) => {
  await linkSkill({ skillId: skill.id, target: { agentId, scope: 'global', repoId: '' }, dryRun: false });
  expect(await realpath(join(state.root, agentId, 'skills', 'demo'))).toBe(skill.canonicalId);
});

it.each(['claude-code','pi','cursor'])('saves %s explicit-only policy and restores the exact original', async (agentId) => {
  await setTrigger({ skillId: skill.id, agentId, changes: { ...defaults, disableModelInvocation: true }, dryRun: true });
  expect(await readFile(join(skill.canonicalId, 'SKILL.md'), 'utf8')).toBe(raw);
  await setTrigger({ skillId: skill.id, agentId, changes: { ...defaults, disableModelInvocation: true }, dryRun: false });
  expect(parseSkillFile(await readFile(join(skill.canonicalId, 'SKILL.md'), 'utf8'), 'demo').frontmatter.disableModelInvocation).toBe(true);
  await applySteps(state.inverse);
  expect(await readFile(join(skill.canonicalId, 'SKILL.md'), 'utf8')).toBe(raw);
});

it('writes Codex config and metadata independently of Claude frontmatter, then undoes both', async () => {
  const config = join(state.root, 'codex/config.toml');
  await mkdir(join(state.root, 'codex'), { recursive: true });
  await writeFile(config, 'model = "keep-me"\n');
  await setTrigger({ skillId: skill.id, agentId: 'codex', changes: { ...defaults, codexEnabled: false, codexImplicitAllowed: false }, dryRun: false });
  expect(parseSettings(await readFile(config, 'utf8'), 'toml')).toEqual({ model: 'keep-me', skills: { config: [{ path: join(skill.canonicalId, 'SKILL.md'), enabled: false }] } });
  expect(await readFile(join(skill.canonicalId, 'agents/openai.yaml'), 'utf8')).toContain('allow_implicit_invocation: false');
  expect(await readFile(join(skill.canonicalId, 'SKILL.md'), 'utf8')).toBe(raw);
  await applySteps(state.inverse);
  expect(await readFile(config, 'utf8')).toBe('model = "keep-me"\n');
  await expect(readFile(join(skill.canonicalId, 'agents/openai.yaml'))).rejects.toThrow();
});

it('uses OpenCode JSONC permissions and never writes Claude settings', async () => {
  const config = join(state.root, 'opencode/opencode.jsonc');
  await mkdir(join(state.root, 'opencode'), { recursive: true });
  const original = '{ // preserve\n "model":"keep-me" }';
  await writeFile(config, original);
  await setTrigger({ skillId: skill.id, agentId: 'opencode', changes: { ...defaults, openCodePermission: 'ask', openCodeScope: 'global' }, dryRun: false });
  expect(parseSettings(await readFile(config, 'utf8'), 'jsonc')).toEqual({ model: 'keep-me', permission: { skill: { demo: 'ask' } } });
  await expect(readFile(join(state.root, 'claude-code/settings.local.json'))).rejects.toThrow();
  await applySteps(state.inverse);
  expect(await readFile(config, 'utf8')).toBe(original);
});

it('leaves malformed settings unchanged and rejects an unlinked or unsupported policy', async () => {
  const config = join(state.root, 'codex/config.toml');
  await mkdir(join(state.root, 'codex'), { recursive: true });
  await writeFile(config, '[broken');
  await expect(setTrigger({ skillId: skill.id, agentId: 'codex', changes: { ...defaults, codexEnabled: false }, dryRun: false })).rejects.toThrow(/Invalid/);
  expect(await readFile(config, 'utf8')).toBe('[broken');
  await expect(setTrigger({ skillId: skill.id, agentId: 'opencode', changes: { ...defaults, disableModelInvocation: true }, dryRun: false })).rejects.toThrow(/not supported/);
  skill.instances[0]!.readers = ['codex'];
  await expect(setTrigger({ skillId: skill.id, agentId: 'pi', changes: defaults, dryRun: true })).rejects.toThrow(/Link or copy/);
});


it('saves Claude global overrides to user settings, preserving other keys and undo', async () => {
  const config = join(state.root, 'claude-code/settings.json');
  await mkdir(join(state.root, 'claude-code'), { recursive: true });
  const original = '{"model":"keep-me","skillOverrides":{"another":"off"}}';
  await writeFile(config, original);
  await setTrigger({ skillId: skill.id, agentId: 'claude-code', changes: { ...defaults, claudeOverride: 'user-invocable-only' }, dryRun: false });
  expect(JSON.parse(await readFile(config, 'utf8'))).toEqual({ model: 'keep-me', skillOverrides: { another: 'off', demo: 'user-invocable-only' } });
  await expect(readFile(join(state.root, 'claude-code/settings.local.json'))).rejects.toThrow();
  await applySteps(state.inverse);
  expect(await readFile(config, 'utf8')).toBe(original);
});

it('saves Claude project overrides only to project-local settings', async () => {
  skill.instances[0]!.repoId = state.root;
  await setTrigger({ skillId: skill.id, agentId: 'claude-code', changes: { ...defaults, claudeOverride: 'off', claudeOverrideScope: 'project' }, dryRun: false });
  expect(JSON.parse(await readFile(join(state.root, '.claude/settings.local.json'), 'utf8'))).toEqual({ skillOverrides: { demo: 'off' } });
  await expect(readFile(join(state.root, 'claude-code/settings.json'))).rejects.toThrow();
});

async function useLinkedSource() {
  const source = skill.canonicalId;
  const link = join(state.root, 'linked', 'demo');
  await mkdir(join(state.root, 'linked'), { recursive: true });
  await symlink(source, link);
  skill.canonicalId = link;
  Object.assign(skill.instances[0]!, { id: link, absPath: link, parentDir: join(state.root, 'linked'), kind: 'symlink', symlinkTarget: source, isHub: false });
  return { source, link };
}
it('copies and shares a symlink-only skill without modifying its source', async () => {
  const { source } = await useLinkedSource();
  await copySkill({ skillId: skill.id, target: { agentId: 'codex', scope: 'global', repoId: '' }, mode: 'copy', dryRun: false });
  await linkSkill({ skillId: skill.id, target: { agentId: 'claude-code', scope: 'global', repoId: '' }, dryRun: false });
  expect(await readFile(join(state.root, 'codex/skills/demo/references/guide.md'), 'utf8')).toBe('Keep this reference');
  expect(await realpath(join(state.root, 'claude-code/skills/demo'))).toBe(source);
  expect(await readFile(join(source, 'SKILL.md'), 'utf8')).toBe(raw);
});
it('renames a symlink-only skill as a local copy and undo restores its link', async () => {
  const { source, link } = await useLinkedSource();
  await renameSkill({ skillId: skill.id, newName: 'renamed', dryRun: true });
  expect(await realpath(link)).toBe(source);
  await renameSkill({ skillId: skill.id, newName: 'renamed', dryRun: false });
  expect(await readFile(join(state.root, 'linked/renamed/SKILL.md'), 'utf8')).toContain('name: renamed');
  expect(await readFile(join(source, 'SKILL.md'), 'utf8')).toBe(raw);
  await applySteps(state.inverse);
  expect(await realpath(link)).toBe(source);
});
it('rejects unsafe rename values and occupied destinations before mutations', async () => {
  for (const newName of ['../outside', 'name\nother: value', 'UPPERCASE']) await expect(renameSkill({ skillId: skill.id, newName, dryRun: false })).rejects.toThrow();
  await mkdir(join(state.root, 'hub/taken'));
  await expect(renameSkill({ skillId: skill.id, newName: 'taken', dryRun: false })).rejects.toThrow();
  expect(await readFile(join(skill.canonicalId, 'SKILL.md'), 'utf8')).toBe(raw);
});

it('installs globally once per distinct folder, preserves existing installs, and supports undo', async () => {
  const alias = { ...state.index.agents[0]!, id: 'alias', name: 'Alias' };
  state.index.agents.push(alias);
  const existing = join(state.root, 'pi/skills/demo');
  await mkdir(existing, { recursive: true });
  await writeFile(join(existing, 'SKILL.md'), 'Keep existing custom skill');
  const preview = await installEverywhere({ skillId: skill.id, dryRun: true });
  expect(preview.steps.filter((entry) => entry.op === 'copyDir')).toHaveLength(4);
  await expect(readFile(join(state.root, 'codex/skills/demo/SKILL.md'))).rejects.toThrow();
  await installEverywhere({ skillId: skill.id, dryRun: false });
  expect(await readFile(join(state.root, 'codex/skills/demo/references/guide.md'), 'utf8')).toBe('Keep this reference');
  expect(await readFile(join(existing, 'SKILL.md'), 'utf8')).toBe('Keep existing custom skill');
  const inverse = state.inverse;
  expect((await installEverywhere({ skillId: skill.id, dryRun: false })).steps).toHaveLength(0);
  await applySteps(inverse);
  await expect(readFile(join(state.root, 'codex/skills/demo/SKILL.md'))).rejects.toThrow();
  expect(await readFile(join(existing, 'SKILL.md'), 'utf8')).toBe('Keep existing custom skill');
});

it('removes only the selected installed copy to trash and can undo it', async () => {
  const original = skill.canonicalId;
  const copy = join(state.root, 'codex/skills/demo');
  await copySkill({ skillId: skill.id, target: { agentId: 'codex', scope: 'global', repoId: '' }, mode: 'copy', dryRun: false });
  skill.instances.push({ ...skill.instances[0]!, id: copy, absPath: copy, parentDir: join(state.root, 'codex/skills'), kind: 'copy', isHub: false, readers: ['codex'] });
  await trashSkill({ skillId: skill.id, instanceId: copy, dryRun: true });
  expect(await readFile(join(copy, 'SKILL.md'), 'utf8')).toBe(raw);
  await trashSkill({ skillId: skill.id, instanceId: copy, dryRun: false });
  await expect(readFile(join(copy, 'SKILL.md'))).rejects.toThrow();
  expect(await readFile(join(original, 'SKILL.md'), 'utf8')).toBe(raw);
  await applySteps(state.inverse);
  expect(await readFile(join(copy, 'SKILL.md'), 'utf8')).toBe(raw);
});

it('sets skill usage across physical copies, preserves content, and supports undo', async () => {
  const source = skill.instances[0]!;
  const destination = join(state.root, 'second', 'demo');
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'SKILL.md'), raw);
  skill.instances.push({ ...source, id: destination, absPath: destination, readers: ['claude-code'] });
  await setSkillInvocation({ skillId: skill.id, automatic: false, dryRun: true });
  expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toBe(raw);
  await setSkillInvocation({ skillId: skill.id, automatic: false, dryRun: false });
  for (const entry of skill.instances) {
    const parsed = parseSkillFile(await readFile(join(entry.absPath, 'SKILL.md'), 'utf8'), 'demo');
    expect(parsed.frontmatter.disableModelInvocation).toBe(true);
    expect(parsed.body).toContain('Read references/guide.md');
  }
  expect(await readFile(join(source.absPath, 'agents', 'openai.yaml'), 'utf8')).toContain('allow_implicit_invocation: false');
  await applySteps(state.inverse);
  expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toBe(raw);
  expect(await readFile(join(source.absPath, 'SKILL.md'), 'utf8')).toBe(raw);
});
