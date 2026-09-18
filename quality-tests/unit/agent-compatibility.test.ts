import { describe, expect, it } from 'bun:test';
import { codexConfig, codexPolicy, openCodePermission, parseSettings } from '../../apps/server/src/hub/agent-settings';
import { readOpenCodePolicy, openCodeAccess } from '../../apps/server/src/scan/opencode-policy';
import { DEFAULT_CONFIG } from '../../apps/server/src/config/config.constants';
import { expandPath, globalSkillDirs, projectSkillDirNames, resolveAgents, readersForGlobalDir, readersForProjectDir } from '../../apps/server/src/registry/agents';
import { computeCells } from '../../apps/server/src/visibility/visibility';
import { parseSkillFile } from '../../apps/server/src/scan/frontmatter';
import type { Skill, } from '../../apps/server/src/scan/index.types';
import type { SkillInstance } from '../../apps/server/src/scan/walk.types';
import type { Agent } from '../../apps/server/src/registry/agents.types';

const frontmatter = parseSkillFile('---\nname: demo\ndescription: Demo skill\ndisable-model-invocation: true\nuser-invocable: false\npaths: src/**\n---\nBody', 'demo').frontmatter;
const instance: SkillInstance = { id: '/fixture/demo', name: 'demo', absPath: '/fixture/demo', parentDir: '/fixture', kind: 'canonical', scope: 'global', readers: ['codex','claude-code','pi','cursor','opencode','other'], repoId: '', nestedDir: '', symlinkTarget: '', contentHash: '', frontmatter, body: 'Body', files: ['SKILL.md'], gitState: 'none', errors: [], pluginName: '', pluginVersion: '', isHub: false };
const skill: Skill = { id: 'global:demo', name: 'demo', scope: 'global', repoId: '', repoName: '', canonicalId: instance.id, description: 'Demo', instances: [instance], diverged: false, shadowed: false, pluginName: '', errors: [] };
function agent(id: string): Agent {
  return { id, name: id, globalDir: '/fixture', projectDir: '.agents/skills', legacyGlobalDirs: [], legacyProjectDirs: [], detect: [], overrideSource: id === 'codex' ? 'codex' : id === 'claude-code' ? 'claude' : 'none', resolvedGlobalDir: '/fixture', resolvedLegacyGlobalDirs: [], installed: true, custom: false };
}
const overrides = { claudeGlobal: {}, claudeByRepo: {}, codexDisabled: [] };

describe('agent-specific visibility', () => {
  it('limits default discovery and transfer destinations to the five supported agents', async () => {
    const agents = await resolveAgents(DEFAULT_CONFIG);
    expect(agents.map((entry) => entry.id)).toEqual(['claude-code', 'codex', 'cursor', 'opencode', 'pi']);
    expect(readersForGlobalDir(agents, expandPath('$HOME/.agents/skills')).sort()).toEqual(['codex', 'cursor', 'opencode', 'pi']);
    expect(globalSkillDirs(agents)).not.toContain(expandPath('$HOME/.gemini/skills'));
    expect(globalSkillDirs(agents)).not.toContain(expandPath('$HOME/.grok/skills'));
    expect(projectSkillDirNames(agents)).not.toContain('.github/skills');
    expect(readersForProjectDir(agents, '/repo', '/repo/.windsurf/skills')).toEqual([]);
  });
  it('keeps an explicitly configured custom agent without restoring the broad registry', async () => {
    const custom = { ...agent('custom-tool'), globalDir: '/fixture/custom/skills', projectDir: '.custom/skills', detect: [] };
    const agents = await resolveAgents({ ...DEFAULT_CONFIG, customAgents: [custom] });
    expect(agents).toHaveLength(6);
    expect(agents.find((entry) => entry.id === custom.id)?.custom).toBe(true);
    expect(readersForGlobalDir(agents, '/fixture/custom/skills')).toEqual(['custom-tool']);
    expect(readersForProjectDir(agents, '/repo', '/repo/.custom/skills')).toEqual(['custom-tool']);
  });
  it.each([['codex','auto'],['claude-code','off'],['pi','user-only'],['cursor','user-only'],['opencode','auto'],['other','unknown']] as const)('%s uses only its supported invocation fields', (id, state) => {
    const cell = computeCells(skill, [agent(id)], [], overrides, false)[0];
    expect(cell?.state).toBe(state);
    expect(cell?.conditions.some((text) => text === 'editing src/**')).toBe(['claude-code','cursor'].includes(id));
  });
  it('applies Codex disabling by skill path rather than name', () => {
    expect(computeCells(skill, [agent('codex')], [], { ...overrides, codexDisabled: ['/other/demo/SKILL.md'] }, false)[0]?.state).toBe('auto');
    expect(computeCells(skill, [agent('codex')], [], { ...overrides, codexDisabled: ['/fixture/demo/SKILL.md'] }, false)[0]?.state).toBe('off');
  });
  it('reads Codex implicit policy and reports malformed policy as unknown', () => {
    const policySkill = { ...skill, instances: [{ ...instance, codexImplicitAllowed: false }] };
    expect(computeCells(policySkill, [agent('codex')], [], overrides, false)[0]?.state).toBe('user-only');
    expect(computeCells(skill, [agent('codex')], [], { ...overrides, codexError: true }, false)[0]?.state).toBe('unknown');
  });
  it('finds Pi skills in both its own and shared directories', async () => {
    const agents = await resolveAgents(DEFAULT_CONFIG);
    const pi = agents.find((entry) => entry.id === 'pi');
    expect(readersForGlobalDir(agents, pi!.resolvedLegacyGlobalDirs[0]!)).toContain('pi');
    expect(readersForProjectDir(agents, '/repo', '/repo/.agents/skills')).toContain('pi');
    expect(readersForProjectDir(agents, '/repo', '/repo/.pi/skills')).toContain('pi');
    expect(agents.find((entry) => entry.id === 'opencode')?.projectDir).toBe('.opencode/skills');
  });
});

it('prefers Claude project settings over user settings', () => {
  const projectSkill = { ...skill, instances: [{ ...instance, repoId: '/repo', frontmatter: { ...frontmatter, disableModelInvocation: false, userInvocable: true } }] };
  const state = { ...overrides, claudeGlobal: { demo: 'off' }, claudeByRepo: { '/repo': { demo: 'user-invocable-only' } } };
  expect(computeCells(projectSkill, [agent('claude-code')], [], state, false)[0]?.state).toBe('user-only');
});

describe('settings preservation and vendor schemas', () => {
  it('updates one path-based Codex entry and preserves other settings', () => {
    const raw = 'model = "example"\n[[skills.config]]\npath = "/fixture/demo/SKILL.md"\nenabled = false\n[[skills.config]]\npath = "/other/demo/SKILL.md"\nenabled = false\n';
    const result = parseSettings(codexConfig(raw, '/fixture/demo/SKILL.md', true), 'toml');
    expect(result.model).toBe('example');
    expect(result.skills).toEqual({ config: [{ path: '/fixture/demo/SKILL.md', enabled: true }, { path: '/other/demo/SKILL.md', enabled: false }] });
  });
  it('keeps Codex YAML metadata and comments while changing policy', () => {
    const result = codexPolicy('# keep this\ninterface:\n  display_name: Demo\npolicy:\n  allow_implicit_invocation: true\n', false);
    expect(result).toContain('# keep this'); expect(result).toContain('display_name: Demo'); expect(result).toContain('allow_implicit_invocation: false');
  });
  it.each(['[broken', 'skills = 4'])('refuses malformed Codex configuration: %s', (raw) => {
    expect(() => codexConfig(raw, '/fixture/demo/SKILL.md', false)).toThrow();
  });
  it('preserves OpenCode comments, other permissions and explicit precedence', () => {
    const raw = '{ // personal\n "model": "example", "permission": {"edit":"ask", "skill":{"demo":"deny", "*":"ask"}}}';
    const result = openCodePermission(raw, 'demo', 'allow');
    expect(result).toContain('// personal');
    const parsed = parseSettings(result, 'jsonc');
    expect(parsed.model).toBe('example');
    expect(parsed.permission).toEqual({ edit: 'ask', skill: { '*': 'ask', demo: 'allow' } });
  });
  it('refuses invalid JSONC and unsupported OpenCode V2 schemas', () => {
    expect(() => openCodePermission('{ broken', 'demo', 'deny')).toThrow();
    expect(() => openCodePermission('{"permissions":[]}', 'demo', 'deny')).toThrow(/V2/);
  });
  it('models OpenCode allow/ask/deny and unresolved overrides honestly', () => {
    const global = { rules: { '*': 'deny', 'demo*': 'ask' }, uncertain: false };
    expect(openCodeAccess('demo', global, undefined)).toBe('ask');
    expect(openCodeAccess('other', global, undefined)).toBe('off');
    expect(openCodeAccess('demo', global, { rules: { demo: 'allow' }, uncertain: false })).toBe('auto');
    expect(openCodeAccess('demo', { ...global, uncertain: true }, undefined)).toBe('unknown');
  });
  it('treats absent project OpenCode configuration as no override', async () => {
    expect(await readOpenCodePolicy('/tmp/skillet-nonexistent-agent-fixture')).toEqual({ rules: {}, uncertain: false });
  });
});
