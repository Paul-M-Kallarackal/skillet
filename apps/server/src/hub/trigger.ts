import { join } from 'node:path';
import { realpath } from 'node:fs/promises';
import { expandPath } from '../registry/agents';
import { hasVerifiedPolicy, supportsExplicitOnly, supportsSkillPaths } from '../registry/skill-policy';
import { serialiseSkillFile } from '../scan/frontmatter';
import { getIndex } from '../scan/scanner';
import type { SkillInstance } from '../scan/walk.types';
import { appendEntry } from './journal';
import { assertInsideRoots, assertNotPlugin } from './preflight';
import { applySteps } from './steps';
import { codexConfig, codexPolicy, configSteps, openCodeConfigFile, openCodePermission, parseSettings, record, settingsError } from './agent-settings';
import type { FsStep, OpResult } from './steps.types';

export interface TriggerChanges {
  disableModelInvocation: boolean;
  userInvocable: boolean;
  paths: string[];
  claudeOverride: string;
  claudeOverrideScope: 'global' | 'project';
  codexEnabled: boolean;
  codexImplicitAllowed?: boolean;
  openCodePermission?: string;
  openCodeScope?: 'global' | 'project';
}

export interface TriggerInput {
  skillId: string;
  agentId: string;
  changes: TriggerChanges;
  dryRun: boolean;
}

function requireInstance(skillId: string, agentId: string): SkillInstance {
  for (const skill of getIndex().skills) {
    if (skill.id !== skillId) {
      continue;
    }
    if (skill.scope === 'plugin') {
      throw settingsError('Plugin-managed skills are read-only. Make an independent copy first.');
    }
    for (const instance of skill.instances) {
      if (instance.readers.includes(agentId)) {
        return instance;
      }
    }
  }
  throw settingsError('Link or copy this skill to the selected agent before changing its invocation.');
}

function validateChanges(input: TriggerInput, instance: SkillInstance): void {
  const c = input.changes;
  if (!c || typeof c.disableModelInvocation !== 'boolean' || typeof c.userInvocable !== 'boolean' || !Array.isArray(c.paths) || c.paths.some((path) => typeof path !== 'string')) {
    throw settingsError('Invalid invocation settings. Reload the skill and try again.');
  }
  if (!hasVerifiedPolicy(input.agentId)) {
    throw settingsError('Invocation controls have not been verified for this agent.');
  }
  if ((!supportsExplicitOnly(input.agentId) && c.disableModelInvocation !== instance.frontmatter.disableModelInvocation)
    || (!supportsSkillPaths(input.agentId) && c.paths.join(',') !== instance.frontmatter.paths.join(','))
    || (input.agentId !== 'claude-code' && (c.userInvocable !== instance.frontmatter.userInvocable || c.claudeOverride))) {
    throw settingsError('These invocation fields are not supported by the selected agent.');
  }
  if (input.agentId === 'codex' && (typeof c.codexEnabled !== 'boolean' || (c.codexImplicitAllowed !== undefined && typeof c.codexImplicitAllowed !== 'boolean'))) {
    throw settingsError('Codex invocation settings must be booleans.');
  }
  if (input.agentId !== 'opencode' && c.openCodePermission) {
    throw settingsError('OpenCode permissions can only be edited for OpenCode.');
  }
  if (c.claudeOverrideScope !== 'global' && c.claudeOverrideScope !== 'project') {
    throw settingsError('Choose global or project scope.');
  }
}

export async function setTrigger(input: TriggerInput): Promise<OpResult> {
  const instance = requireInstance(input.skillId, input.agentId);
  validateChanges(input, instance);
  await assertNotPlugin(instance.absPath);
  await assertInsideRoots([instance.absPath, await realpath(instance.absPath)]);
  const c = input.changes;
  const steps: FsStep[] = [];
  const inverse: FsStep[] = [];
  const add = (plan: { steps: FsStep[]; inverse: FsStep[] }) => {
    steps.push(...plan.steps);
    inverse.unshift(...plan.inverse);
  };
  const frontmatter = instance.frontmatter;
  if (c.disableModelInvocation !== frontmatter.disableModelInvocation || c.userInvocable !== frontmatter.userInvocable || c.paths.join(',') !== frontmatter.paths.join(',')) {
    if (instance.errors.some((error) => error.severity === 'error')) { throw settingsError('Repair invalid skill frontmatter before changing its invocation fields.'); }
    add(await configSteps(join(instance.absPath, 'SKILL.md'), () => serialiseSkillFile({ ...frontmatter, disableModelInvocation: c.disableModelInvocation, userInvocable: c.userInvocable, paths: c.paths }, instance.body)));
  }
  if (input.agentId === 'claude-code' && c.claudeOverride) {
    if (!['on', 'name-only', 'user-invocable-only', 'off'].includes(c.claudeOverride)) {
      throw settingsError('Invalid Claude Code availability override.');
    }
    let base = expandPath('$CLAUDE_CONFIG_DIR');
    let filename = 'settings.json';
    if (c.claudeOverrideScope === 'project') {
      if (!instance.repoId) {
        throw settingsError('Choose a project skill before editing project settings.');
      }
      base = join(instance.repoId, '.claude');
      filename = 'settings.local.json';
    }
    add(await configSteps(join(base, filename), (text) => {
      const data = parseSettings(text, 'jsonc');
      const overrides = record(data.skillOverrides ?? {});
      overrides[instance.name] = c.claudeOverride;
      return `${JSON.stringify({ ...data, skillOverrides: overrides }, null, 2)}\n`;
    }));
  }
  if (input.agentId === 'codex') {
    add(await configSteps(join(expandPath('$CODEX_HOME'), 'config.toml'), (text) => codexConfig(text, join(instance.absPath, 'SKILL.md'), c.codexEnabled), ''));
    if (c.codexImplicitAllowed !== undefined && c.codexImplicitAllowed !== (instance.codexImplicitAllowed ?? true)) {
      add(await configSteps(join(instance.absPath, 'agents', 'openai.yaml'), (text) => codexPolicy(text, c.codexImplicitAllowed === true), ''));
    }
  }
  if (input.agentId === 'opencode' && c.openCodePermission) {
    if (c.openCodeScope !== 'global' && c.openCodeScope !== 'project') {
      throw settingsError('Choose global or project OpenCode settings.');
    }
    let repoRoot = '';
    if (c.openCodeScope === 'project') {
      if (!instance.repoId) {
        throw settingsError('Choose a project skill before editing project permissions.');
      }
      repoRoot = instance.repoId;
    }
    const file = await openCodeConfigFile(repoRoot);
    add(await configSteps(file, (text) => openCodePermission(text, instance.name, c.openCodePermission ?? '')));
  }
  if (input.dryRun) {
    return { steps, applied: false, journalId: '' };
  }
  await applySteps(steps);
  const entry = await appendEntry({ action: 'trigger', skillId: input.skillId, steps }, inverse);
  return { steps, applied: true, journalId: entry.id };
}

export async function setSkillInvocation(input: { skillId: string; automatic: boolean; dryRun: boolean }): Promise<OpResult> {
  const skill = getIndex().skills.find((entry) => entry.id === input.skillId);
  if (!skill || skill.scope === 'plugin') throw settingsError('This skill cannot be edited.');
  const steps: FsStep[] = [];
  const inverse: FsStep[] = [];
  const seen = new Set<string>();
  for (const instance of skill.instances) {
    const dir = await realpath(instance.absPath);
    if (seen.has(dir)) continue;
    seen.add(dir);
    await assertInsideRoots([instance.absPath]);
    await assertNotPlugin(dir);
    if (instance.errors.some((error) => error.severity === 'error')) throw settingsError('Repair invalid skill metadata before changing its usage.');
    const content = await configSteps(join(dir, 'SKILL.md'), () => serialiseSkillFile({ ...instance.frontmatter, disableModelInvocation: !input.automatic, userInvocable: true }, instance.body));
    steps.push(...content.steps); inverse.unshift(...content.inverse);
    if (skill.instances.some((entry) => entry.readers.includes('codex') && (entry.absPath === instance.absPath || entry.symlinkTarget === dir))) {
      const policy = await configSteps(join(dir, 'agents', 'openai.yaml'), (text) => codexPolicy(text, input.automatic), '');
      steps.push(...policy.steps); inverse.unshift(...policy.inverse);
    }
  }
  if (input.dryRun || !steps.length) return { steps, applied: false, journalId: '' };
  await applySteps(steps);
  const entry = await appendEntry({ action: 'skill-invocation', skillId: skill.id, steps }, inverse);
  return { steps, applied: true, journalId: entry.id };
}
