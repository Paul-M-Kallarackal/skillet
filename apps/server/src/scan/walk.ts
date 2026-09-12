import { parseDocument } from 'yaml';
import { readOptional, record } from '../hub/agent-settings';
import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { lstat, readdir, readFile, readlink, realpath, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { SkilletError } from '../errors';
import { parseSkillFile } from './frontmatter';
import type { BuildInstanceInput, GitState, SkillDirRef, SkillInstance } from './walk.types';

const SERVICE = 'WalkService';
const NOISE_FILES = ['.DS_Store'];

export async function readSkillDirs(parentDir: string): Promise<SkillDirRef[]> {
  try {
    let entries: Dirent[] = [];
    try {
      entries = await readdir(parentDir, { withFileTypes: true });
    } catch {
      return [];
    }
    const candidates: string[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      if (entry.isFile()) {
        continue;
      }
      candidates.push(entry.name);
    }
    const refs = await Promise.all(
      candidates.map(async (name) => {
        const absPath = join(parentDir, name);
        let isSymlink = false;
        let symlinkTarget = '';
        try {
          const info = await lstat(absPath);
          if (info.isSymbolicLink()) {
            isSymlink = true;
            const raw = await readlink(absPath);
            symlinkTarget = resolve(parentDir, raw);
          }
        } catch {
          return null;
        }
        try {
          await stat(join(absPath, 'SKILL.md'));
        } catch {
          return null;
        }
        const ref: SkillDirRef = { name, absPath, isSymlink, symlinkTarget };
        return ref;
      })
    );
    const out: SkillDirRef[] = [];
    for (const ref of refs) {
      if (ref) {
        out.push(ref);
      }
    }
    return out;
  } catch (error) {
    throw new SkilletError({
      message: `failed to read skill dirs in ${parentDir}`,
      method: 'readSkillDirs',
      service: SERVICE,
      error
    });
  }
}

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const queue: string[] = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    let entries: Dirent[] = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (NOISE_FILES.includes(entry.name)) {
        continue;
      }
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(abs);
        continue;
      }
      out.push(relative(root, abs).split(sep).join('/'));
    }
  }
  out.sort();
  return out;
}

export async function buildInstance(input: BuildInstanceInput): Promise<SkillInstance> {
  try {
    const skillPath = join(input.ref.absPath, 'SKILL.md');
    const raw = await readFile(skillPath, 'utf8');
    const parsed = parseSkillFile(raw, input.ref.name);
    let codexImplicitAllowed = true;
    let policyError = '';
    if (input.readers.includes('codex')) {
      try {
        const policyText = await readOptional(join(input.ref.absPath, 'agents', 'openai.yaml'));
        if (policyText !== null) {
          const document = parseDocument(policyText);
          if (document.errors.length > 0) { throw new Error('Invalid YAML'); }
          const data: unknown = document.toJSON();
          if (data !== null) {
            const policy = record(record(data).policy ?? {});
            if (policy.allow_implicit_invocation !== undefined && typeof policy.allow_implicit_invocation !== 'boolean') {
              throw new Error('Invalid invocation policy');
            }
            codexImplicitAllowed = policy.allow_implicit_invocation !== false;
          }
        }
      } catch {
        policyError = 'Cannot read Codex invocation policy. Repair agents/openai.yaml.';
      }
    }
    const files = await listFiles(input.ref.absPath);
    const hash = createHash('sha256');
    hash.update(raw);
    hash.update(files.join('\n'));
    let kind: SkillInstance['kind'] = 'canonical';
    if (input.scope === 'plugin') {
      kind = 'plugin';
    } else if (input.ref.isSymlink) {
      kind = 'symlink';
    }
    let resolvedTarget = input.ref.symlinkTarget;
    if (input.ref.isSymlink) {
      try {
        resolvedTarget = await realpath(input.ref.absPath);
      } catch {
        resolvedTarget = input.ref.symlinkTarget;
      }
    }
    const noneState: GitState = 'none';
    return {
      id: input.ref.absPath,
      name: input.ref.name,
      absPath: input.ref.absPath,
      parentDir: input.ref.absPath.slice(0, input.ref.absPath.length - input.ref.name.length - 1),
      kind,
      scope: input.scope,
      readers: input.readers,
      repoId: input.repoId,
      nestedDir: input.nestedDir,
      symlinkTarget: resolvedTarget,
      codexImplicitAllowed,
      policyError,
      contentHash: hash.digest('hex').slice(0, 16),
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      files,
      gitState: noneState,
      errors: parsed.errors,
      pluginName: input.pluginName,
      pluginVersion: input.pluginVersion,
      isHub: input.isHub
    };
  } catch (error) {
    throw new SkilletError({
      message: `failed to build instance for ${input.ref.absPath}`,
      method: 'buildInstance',
      service: SERVICE,
      error
    });
  }
}

export async function findAgentDirsInRepo(
  repoRoot: string,
  dirNames: string[],
  ignore: string[],
  maxDepth: number
): Promise<string[]> {
  try {
    const found: string[] = [];
    const visited = new Set<string>();
    try {
      visited.add(await realpath(repoRoot));
    } catch {
      visited.add(repoRoot);
    }
    const queue: { dir: string; depth: number }[] = [{ dir: repoRoot, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      const candidates: string[] = [];
      for (const name of dirNames) {
        candidates.push(join(current.dir, name));
      }
      const checks = await Promise.all(
        candidates.map(async (candidate) => {
          try {
            const info = await stat(candidate);
            if (info.isDirectory()) {
              return candidate;
            }
            return '';
          } catch {
            return '';
          }
        })
      );
      for (const hit of checks) {
        if (hit.length > 0 && !found.includes(hit)) {
          found.push(hit);
        }
      }
      if (current.depth >= maxDepth) {
        continue;
      }
      let entries: Dirent[] = [];
      try {
        entries = await readdir(current.dir, { withFileTypes: true });
      } catch {
        continue;
      }
      const childNames: string[] = [];
      for (const entry of entries) {
        if (ignore.includes(entry.name)) {
          continue;
        }
        if (!entry.isDirectory() && !entry.isSymbolicLink()) {
          continue;
        }
        childNames.push(entry.name);
      }
      const children = await Promise.all(
        childNames.map(async (name) => {
          const child = join(current.dir, name);
          try {
            const info = await stat(child);
            if (!info.isDirectory()) {
              return '';
            }
            const real = await realpath(child);
            if (visited.has(real)) {
              return '';
            }
            visited.add(real);
            return child;
          } catch {
            return '';
          }
        })
      );
      for (const child of children) {
        if (child.length === 0) {
          continue;
        }
        queue.push({ dir: child, depth: current.depth + 1 });
      }
    }
    return found;
  } catch (error) {
    throw new SkilletError({
      message: `failed to find agent dirs in ${repoRoot}`,
      method: 'findAgentDirsInRepo',
      service: SERVICE,
      error
    });
  }
}
