import { lstat, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig } from '../config/config';
import { TRASH_PATH } from '../config/config.constants';
import { SkilletError } from '../errors';
import { globalSkillDirs, resolveAgents } from '../registry/agents';

const SERVICE = 'PreflightService';

async function allowedRoots(): Promise<string[]> {
  const config = await loadConfig();
  const agents = await resolveAgents(config);
  const roots: string[] = [config.hubPath, TRASH_PATH, ...config.projectRoots, ...globalSkillDirs(agents)];
  return roots;
}

export async function assertInsideRoots(paths: string[]): Promise<void> {
  try {
    const roots = await allowedRoots();
    for (const path of paths) {
      const absolute = resolve(path);
      let ok = false;
      for (const root of roots) {
        if (absolute === root || absolute.startsWith(`${root}/`)) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        throw new SkilletError({
          message: `path outside allowed roots: ${absolute}`,
          method: 'assertInsideRoots',
          service: SERVICE,
          error: null,
          code: 'OUT_OF_ROOTS',
          status: 400
        });
      }
    }
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({
      message: 'preflight root check failed',
      method: 'assertInsideRoots',
      service: SERVICE,
      error
    });
  }
}

export async function assertFree(path: string): Promise<void> {
  let exists = true;
  try {
    await lstat(path);
  } catch {
    exists = false;
  }
  if (exists) {
    throw new SkilletError({
      message: `destination already exists: ${path}`,
      method: 'assertFree',
      service: SERVICE,
      error: null,
      code: 'DEST_EXISTS',
      status: 409
    });
  }
}

export async function assertRealDir(path: string): Promise<void> {
  let isDir = false;
  let found = true;
  try {
    const info = await stat(path);
    isDir = info.isDirectory();
  } catch {
    found = false;
  }
  if (!found) {
    throw new SkilletError({
      message: `missing directory: ${path}`,
      method: 'assertRealDir',
      service: SERVICE,
      error: null,
      code: 'MISSING',
      status: 404
    });
  }
  if (!isDir) {
    throw new SkilletError({
      message: `not a directory: ${path}`,
      method: 'assertRealDir',
      service: SERVICE,
      error: null,
      code: 'NOT_A_DIR',
      status: 400
    });
  }
}

export async function assertSymlink(path: string): Promise<void> {
  let isLink = false;
  let found = true;
  try {
    const info = await lstat(path);
    isLink = info.isSymbolicLink();
  } catch {
    found = false;
  }
  if (!found) {
    throw new SkilletError({
      message: `missing symlink: ${path}`,
      method: 'assertSymlink',
      service: SERVICE,
      error: null,
      code: 'MISSING',
      status: 404
    });
  }
  if (!isLink) {
    throw new SkilletError({
      message: `refusing to unlink a real directory: ${path}`,
      method: 'assertSymlink',
      service: SERVICE,
      error: null,
      code: 'NOT_A_SYMLINK',
      status: 400
    });
  }
}

export async function assertNotPlugin(path: string): Promise<void> {
  let absolute = resolve(path);
  try {
    absolute = await realpath(path);
  } catch {
    absolute = resolve(path);
  }
  if (absolute.includes('/plugins/cache/')) {
    throw new SkilletError({
      message: 'plugin skills are read-only',
      method: 'assertNotPlugin',
      service: SERVICE,
      error: null,
      code: 'PLUGIN_READONLY',
      status: 400
    });
  }
}
