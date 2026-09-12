import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { parseDocument } from 'yaml';
import { applyEdits, modify, parse, type ParseError } from 'jsonc-parser';
import { SkilletError } from '../errors';
import { expandPath } from '../registry/agents';
import { step, writeStep } from './steps';
import type { FsStep } from './steps.types';

export function settingsError(message: string): SkilletError {
  return new SkilletError({ message, method: 'agentSettings', service: 'TriggerService', error: null, code: 'VALIDATION', status: 400 });
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw settingsError('Expected a settings object. Repair the configuration before saving.');
  }
  return value as Record<string, unknown>;
}

export async function readOptional(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw settingsError(`Cannot read ${file}. Check access before saving.`);
  }
}

export function parseSettings(text: string, format: 'toml' | 'jsonc'): Record<string, unknown> {
  try {
    if (format === 'toml') {
      return record(parseToml(text));
    }
    const errors: ParseError[] = [];
    const data: unknown = parse(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) {
      throw settingsError('Invalid JSON/JSONC configuration. Repair it before saving.');
    }
    return record(data);
  } catch {
    throw settingsError(`Invalid ${format.toUpperCase()} configuration. Existing settings were not changed.`);
  }
}

export function codexConfig(text: string, skillFile: string, enabled: boolean): string {
  const data = parseSettings(text, 'toml');
  const skills = record(data.skills ?? {});
  const entries = skills.config ?? [];
  if (!Array.isArray(entries)) {
    throw settingsError('skills.config must be an array of path-based entries.');
  }
  const next: Record<string, unknown>[] = [];
  let found = false;
  for (const entry of entries) {
    const item = record(entry);
    if (typeof item.path === 'string' && expandPath(item.path) === resolve(skillFile)) {
      next.push({ ...item, enabled });
      found = true;
    } else {
      next.push(item);
    }
  }
  if (!found && enabled) { return text; }
  if (!found) {
    next.push({ path: resolve(skillFile), enabled });
  }
  data.skills = { ...skills, config: next };
  return stringifyToml(data);
}

export function codexPolicy(text: string, allowed: boolean): string {
  const document = parseDocument(text);
  if (document.errors.length > 0) {
    throw settingsError('Invalid agents/openai.yaml. Repair it before saving.');
  }
  const data: unknown = document.toJSON();
  if (data !== null) {
    const root = record(data);
    if (root.policy !== undefined) {
      record(root.policy);
    }
  }
  document.setIn(['policy', 'allow_implicit_invocation'], allowed);
  return document.toString();
}

export async function configSteps(file: string, transform: (text: string) => string, empty = '{}'): Promise<{ steps: FsStep[]; inverse: FsStep[] }> {
  const previous = await readOptional(file);
  const content = transform(previous ?? empty);
  if (content === previous || (previous === null && content === empty)) {
    return { steps: [], inverse: [] };
  }
  let undo = step('unlink', '', file, `remove newly created ${file}`);
  if (previous !== null) {
    undo = writeStep(file, previous, `restore ${file}`);
  }
  return { steps: [writeStep(file, content, `update ${file}`)], inverse: [undo] };
}

export async function openCodeConfigFile(repoRoot = ''): Promise<string> {
  let base = expandPath('$XDG_CONFIG_HOME/opencode');
  if (repoRoot.length > 0) {
    base = repoRoot;
  }
  const json = join(base, 'opencode.json');
  const jsonc = join(base, 'opencode.jsonc');
  if (await readOptional(jsonc) !== null) {
    return jsonc;
  }
  return json;
}

export function openCodePermission(text: string, name: string, permission: string): string {
  if (!['allow', 'ask', 'deny'].includes(permission)) {
    throw settingsError('Choose allow, ask, or deny for OpenCode.');
  }
  const data = parseSettings(text, 'jsonc');
  if ('permissions' in data) {
    throw settingsError('This file uses OpenCode V2 permissions; editing that schema is not supported yet.');
  }
  let existing: Record<string, unknown> = {};
  if (typeof data.permission === 'string') {
    existing = { '*': data.permission };
  } else if (data.permission !== undefined) {
    existing = record(data.permission);
  }
  let skills: Record<string, unknown> = {};
  if (typeof existing.skill === 'string') {
    skills = { '*': existing.skill };
  } else if (existing.skill !== undefined) {
    skills = record(existing.skill);
  }
  delete skills[name];
  skills[name] = permission;
  const value = { ...existing, skill: skills };
  return applyEdits(text, modify(text, ['permission'], value, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
}
