import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ParsedSkillFile, SkillFrontmatter, ValidationError } from './frontmatter.types';

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const KNOWN_KEYS = [
  'name',
  'description',
  'paths',
  'disable-model-invocation',
  'user-invocable',
  'allowed-tools',
  'disallowed-tools',
  'license',
  'compatibility',
  'model',
  'agent',
  'context',
  'metadata'
];

function emptyFrontmatter(): SkillFrontmatter {
  return {
    name: '',
    description: '',
    paths: [],
    disableModelInvocation: false,
    userInvocable: true,
    allowedTools: '',
    disallowedTools: '',
    license: '',
    compatibility: '',
    model: '',
    agent: '',
    context: '',
    metadata: {},
    extras: {},
    presentKeys: []
  };
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function toPathList(value: unknown): string[] {
  const list: string[] = [];
  if (typeof value === 'string') {
    for (const part of value.split(',')) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        list.push(trimmed);
      }
    }
    return list;
  }
  if (Array.isArray(value)) {
    for (const part of value) {
      const text = toStringValue(part).trim();
      if (text.length > 0) {
        list.push(text);
      }
    }
  }
  return list;
}

function toStringMap(value: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      map[key] = toStringValue(entry);
    }
  }
  return map;
}

function splitRaw(raw: string): { head: string; body: string; hadFrontmatter: boolean } {
  if (!raw.startsWith('---')) {
    return { head: '', body: raw, hadFrontmatter: false };
  }
  const lines = raw.split('\n');
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === '---') {
      end = index;
      break;
    }
  }
  if (end === -1) {
    return { head: '', body: raw, hadFrontmatter: false };
  }
  const head = lines.slice(1, end).join('\n');
  const body = lines.slice(end + 1).join('\n');
  return { head, body, hadFrontmatter: true };
}

export function parseSkillFile(raw: string, dirName: string): ParsedSkillFile {
  const errors: ValidationError[] = [];
  const frontmatter = emptyFrontmatter();
  const split = splitRaw(raw);
  if (!split.hadFrontmatter) {
    errors.push({ code: 'NO_FRONTMATTER', message: 'SKILL.md has no YAML frontmatter', severity: 'error' });
    return { frontmatter, body: split.body.trimStart(), errors };
  }

  let data: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(split.head) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch (error) {
    let message = 'invalid yaml';
    if (error instanceof Error) {
      message = error.message;
    }
    errors.push({ code: 'YAML_PARSE', message, severity: 'error' });
    return { frontmatter, body: split.body.trimStart(), errors };
  }

  for (const key of Object.keys(data)) {
    frontmatter.presentKeys.push(key);
    if (!KNOWN_KEYS.includes(key)) {
      frontmatter.extras[key] = data[key];
    }
  }

  frontmatter.name = toStringValue(data.name);
  frontmatter.description = toStringValue(data.description);
  frontmatter.paths = toPathList(data.paths);
  frontmatter.allowedTools = toStringValue(data['allowed-tools']);
  frontmatter.disallowedTools = toStringValue(data['disallowed-tools']);
  frontmatter.license = toStringValue(data.license);
  frontmatter.compatibility = toStringValue(data.compatibility);
  frontmatter.model = toStringValue(data.model);
  frontmatter.agent = toStringValue(data.agent);
  frontmatter.context = toStringValue(data.context);
  frontmatter.metadata = toStringMap(data.metadata);
  if (data['disable-model-invocation'] === true) {
    frontmatter.disableModelInvocation = true;
  }
  if (data['user-invocable'] === false) {
    frontmatter.userInvocable = false;
  }

  if (frontmatter.name.length === 0) {
    errors.push({ code: 'NAME_MISSING', message: 'name is required', severity: 'error' });
  } else {
    if (frontmatter.name.length > 64) {
      errors.push({ code: 'NAME_TOO_LONG', message: 'name exceeds 64 characters', severity: 'error' });
    }
    if (!NAME_PATTERN.test(frontmatter.name)) {
      errors.push({
        code: 'NAME_INVALID',
        message: 'name must be lowercase alphanumeric with single hyphens',
        severity: 'error'
      });
    }
    if (frontmatter.name !== dirName) {
      errors.push({
        code: 'NAME_DIR_MISMATCH',
        message: `name "${frontmatter.name}" does not match directory "${dirName}"`,
        severity: 'error'
      });
    }
  }

  if (frontmatter.description.length === 0) {
    errors.push({ code: 'DESCRIPTION_MISSING', message: 'description is required', severity: 'error' });
  }
  if (frontmatter.description.length > 1024) {
    errors.push({
      code: 'DESCRIPTION_TOO_LONG',
      message: 'description exceeds 1024 characters',
      severity: 'error'
    });
  }

  const bodyLines = split.body.split('\n').length;
  if (bodyLines > 500) {
    errors.push({
      code: 'BODY_LONG',
      message: `body is ${bodyLines} lines; move detail into references/`,
      severity: 'warning'
    });
  }

  return { frontmatter, body: split.body.trimStart(), errors };
}

export function serialiseSkillFile(frontmatter: SkillFrontmatter, body: string): string {
  const data: Record<string, unknown> = {};
  data.name = frontmatter.name;
  data.description = frontmatter.description;
  if (frontmatter.paths.length > 0) {
    data.paths = frontmatter.paths.join(',');
  }
  if (frontmatter.disableModelInvocation) {
    data['disable-model-invocation'] = true;
  }
  if (!frontmatter.userInvocable) {
    data['user-invocable'] = false;
  }
  if (frontmatter.allowedTools.length > 0) {
    data['allowed-tools'] = frontmatter.allowedTools;
  }
  if (frontmatter.disallowedTools.length > 0) {
    data['disallowed-tools'] = frontmatter.disallowedTools;
  }
  if (frontmatter.license.length > 0) {
    data.license = frontmatter.license;
  }
  if (frontmatter.compatibility.length > 0) {
    data.compatibility = frontmatter.compatibility;
  }
  if (frontmatter.model.length > 0) {
    data.model = frontmatter.model;
  }
  if (frontmatter.agent.length > 0) {
    data.agent = frontmatter.agent;
  }
  if (frontmatter.context.length > 0) {
    data.context = frontmatter.context;
  }
  if (Object.keys(frontmatter.metadata).length > 0) {
    data.metadata = frontmatter.metadata;
  }
  for (const [key, value] of Object.entries(frontmatter.extras)) {
    data[key] = value;
  }
  const head = stringifyYaml(data, { lineWidth: 0 }).trimEnd();
  const trimmedBody = body.replace(/^\n+/, '');
  return `---\n${head}\n---\n\n${trimmedBody}\n`;
}
