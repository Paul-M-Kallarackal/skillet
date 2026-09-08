import type { Dirent } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { SkilletError } from '../errors';
import type { GitState } from './walk.types';
import type { Repo } from './git.types';

const SERVICE = 'GitService';

async function run(cwd: string, args: string[]): Promise<string> {
  const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  if (proc.exitCode !== 0) {
    return '';
  }
  return text;
}

async function findGitRoots(roots: string[], ignore: string[], maxDepth: number): Promise<string[]> {
  const found: string[] = [];
  const visited = new Set<string>();
  const queue: { dir: string; depth: number }[] = [];
  for (const root of roots) {
    queue.push({ dir: root, depth: 0 });
    visited.add(root);
  }
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    let hasGit = false;
    try {
      await stat(join(current.dir, '.git'));
      hasGit = true;
    } catch {
      hasGit = false;
    }
    if (hasGit) {
      found.push(current.dir);
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
}

function unquotePath(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"') || value.length < 2) {
    return value;
  }
  const inner = value.slice(1, value.length - 1);
  let out = '';
  let index = 0;
  while (index < inner.length) {
    const char = inner[index];
    if (char !== '\\') {
      out += char;
      index += 1;
      continue;
    }
    const next = inner[index + 1];
    if (next === undefined) {
      index += 1;
      continue;
    }
    if (next === 'n') {
      out += '\n';
      index += 2;
      continue;
    }
    if (next === 't') {
      out += '\t';
      index += 2;
      continue;
    }
    if (next === '"' || next === '\\') {
      out += next;
      index += 2;
      continue;
    }
    const octal = inner.slice(index + 1, index + 4);
    if (/^[0-7]{3}$/.test(octal)) {
      out += String.fromCharCode(Number.parseInt(octal, 8));
      index += 4;
      continue;
    }
    out += next;
    index += 2;
  }
  return Buffer.from(out, 'binary').toString('utf8');
}

export async function discoverRepos(roots: string[], ignore: string[], maxDepth: number): Promise<Repo[]> {
  try {
    const gitRoots = await findGitRoots(roots, ignore, maxDepth);
    const infos = await Promise.all(
      gitRoots.map(async (gitRoot) => {
        const [branchText, commonText, statusText] = await Promise.all([
          run(gitRoot, ['rev-parse', '--abbrev-ref', 'HEAD']),
          run(gitRoot, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
          run(gitRoot, ['status', '--porcelain'])
        ]);
        let mainCheckout = gitRoot;
        const common = commonText.trim();
        if (common.length > 0 && common.endsWith('/.git')) {
          mainCheckout = common.slice(0, common.length - 5);
        }
        const name = basename(gitRoot);
        const branch = branchText.trim();
        const isWorktree = mainCheckout !== gitRoot;
        let label = name;
        if (isWorktree) {
          let distinguisher = branch;
          if (distinguisher.length === 0 || distinguisher === 'HEAD') {
            distinguisher = basename(dirname(gitRoot));
          }
          if (distinguisher.length > 0 && distinguisher !== name) {
            label = `${name} (${distinguisher})`;
          }
        }
        const repo: Repo = {
          id: gitRoot,
          name,
          label,
          gitRoot,
          branch,
          isWorktree,
          mainCheckout,
          dirty: statusText.trim().length > 0,
          worktreeIds: []
        };
        return repo;
      })
    );
    const byId = new Map<string, Repo>();
    for (const repo of infos) {
      byId.set(repo.id, repo);
    }
    for (const repo of infos) {
      if (!repo.isWorktree) {
        continue;
      }
      const parent = byId.get(repo.mainCheckout);
      if (parent) {
        parent.worktreeIds.push(repo.id);
      }
    }
    return infos;
  } catch (error) {
    throw new SkilletError({
      message: 'failed to discover git repositories',
      method: 'discoverRepos',
      service: SERVICE,
      error
    });
  }
}

export async function gitStateForPaths(repo: Repo, paths: string[]): Promise<Record<string, GitState>> {
  try {
    const result: Record<string, GitState> = {};
    if (paths.length === 0) {
      return result;
    }
    const relPaths: string[] = [];
    for (const path of paths) {
      relPaths.push(relative(repo.gitRoot, path).split(sep).join('/'));
    }
    const text = await run(repo.gitRoot, ['status', '--porcelain', '--ignored', '--', ...relPaths]);
    const flagged = new Map<string, GitState>();
    for (const line of text.split('\n')) {
      if (line.length < 4) {
        continue;
      }
      const code = line.slice(0, 2);
      let target = line.slice(3).trim();
      const arrow = target.indexOf(' -> ');
      if (arrow !== -1) {
        target = target.slice(arrow + 4).trim();
      }
      target = unquotePath(target);
      target = target.replace(/\/$/, '');
      let state: GitState = 'modified';
      if (code === '??') {
        state = 'untracked';
      }
      if (code === '!!') {
        state = 'ignored';
      }
      flagged.set(target, state);
    }
    for (let index = 0; index < paths.length; index += 1) {
      const abs = paths[index];
      const rel = relPaths[index];
      if (!abs || !rel) {
        continue;
      }
      let state: GitState = 'tracked';
      for (const [target, flaggedState] of flagged) {
        if (rel === target || rel.startsWith(`${target}/`)) {
          state = flaggedState;
          break;
        }
      }
      result[abs] = state;
    }
    return result;
  } catch (error) {
    throw new SkilletError({
      message: `failed to read git state in ${repo.gitRoot}`,
      method: 'gitStateForPaths',
      service: SERVICE,
      error
    });
  }
}
