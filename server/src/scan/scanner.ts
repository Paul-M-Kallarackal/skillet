import { mkdir } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { SkilletError } from '../errors';
import { loadConfig } from '../config/config';
import {
  globalSkillDirs,
  projectSkillDirNames,
  readersForGlobalDir,
  readersForProjectDir,
  resolveAgents
} from '../registry/agents';
import { computeCells } from '../visibility/visibility';
import { discoverRepos, gitStateForPaths } from './git';
import type { Repo } from './git.types';
import { buildSkills } from './index-builder';
import { discoverPluginSkills } from './plugins';
import { readOverrideState } from './overrides';
import { buildInstance, findAgentDirsInRepo, readSkillDirs } from './walk';
import type { SkilletIndex } from './index.types';
import type { GitState, SkillInstance } from './walk.types';

const SERVICE = 'ScannerService';

let current: SkilletIndex = {
  agents: [],
  repos: [],
  skills: [],
  cells: {},
  hubPath: '',
  scannedAt: '',
  stalePluginVersions: 0,
  scanMs: 0
};

export function getIndex(): SkilletIndex {
  return current;
}

export function setIndex(index: SkilletIndex): void {
  current = index;
}

function ownerDirFor(dir: string, projectDirNames: string[]): string {
  let longest = '';
  for (const name of projectDirNames) {
    if (!dir.endsWith(`/${name}`)) {
      continue;
    }
    if (name.length > longest.length) {
      longest = name;
    }
  }
  if (longest.length === 0) {
    return dirname(dir);
  }
  return dir.slice(0, dir.length - longest.length - 1);
}

function innermostRepo(repos: Repo[], dir: string): Repo | null {
  let best: Repo | null = null;
  for (const repo of repos) {
    if (dir !== repo.gitRoot && !dir.startsWith(`${repo.gitRoot}/`)) {
      continue;
    }
    if (!best || repo.gitRoot.length > best.gitRoot.length) {
      best = repo;
    }
  }
  return best;
}

function syntheticRepo(ownerDir: string): Repo {
  const name = basename(ownerDir);
  return {
    id: ownerDir,
    name,
    label: name,
    gitRoot: ownerDir,
    branch: '',
    isWorktree: false,
    mainCheckout: ownerDir,
    dirty: false,
    worktreeIds: []
  };
}

export async function scanAll(): Promise<SkilletIndex> {
  const started = Date.now();
  try {
    const config = await loadConfig();
    await mkdir(config.hubPath, { recursive: true });
    const agents = await resolveAgents(config);

    const globalDirs = globalSkillDirs(agents);
    if (!globalDirs.includes(config.hubPath)) {
      globalDirs.push(config.hubPath);
    }
    const projectDirNames = projectSkillDirNames(agents);

    const [discovered, plugins] = await Promise.all([
      discoverRepos(config.projectRoots, config.ignoreDirs, config.maxDepth),
      discoverPluginSkills()
    ]);
    const repos: Repo[] = discovered;
    const repoById = new Map<string, Repo>();
    for (const repo of repos) {
      repoById.set(repo.id, repo);
    }

    const globalRefLists = await Promise.all(globalDirs.map((dir) => readSkillDirs(dir)));
    const globalTasks: Promise<SkillInstance>[] = [];
    for (let index = 0; index < globalDirs.length; index += 1) {
      const dir = globalDirs[index];
      const refs = globalRefLists[index];
      if (!dir || !refs) {
        continue;
      }
      const readers = readersForGlobalDir(agents, dir);
      const isHub = dir === config.hubPath;
      for (const ref of refs) {
        globalTasks.push(
          buildInstance({
            ref,
            scope: 'global',
            readers,
            repoId: '',
            nestedDir: '',
            isHub,
            pluginName: '',
            pluginVersion: ''
          })
        );
      }
    }

    const rootDirLists = await Promise.all(
      config.projectRoots.map((root) =>
        findAgentDirsInRepo(root, projectDirNames, config.ignoreDirs, config.maxDepth)
      )
    );
    const agentDirs: string[] = [];
    const seenAgentDirs = new Set<string>();
    for (const list of rootDirLists) {
      if (!list) {
        continue;
      }
      for (const dir of list) {
        if (seenAgentDirs.has(dir)) {
          continue;
        }
        seenAgentDirs.add(dir);
        agentDirs.push(dir);
      }
    }

    const projectRefLists = await Promise.all(agentDirs.map((dir) => readSkillDirs(dir)));
    const ownerByDir = new Map<string, Repo>();
    for (let index = 0; index < agentDirs.length; index += 1) {
      const dir = agentDirs[index];
      const refs = projectRefLists[index];
      if (!dir || !refs || refs.length === 0) {
        continue;
      }
      const gitOwner = innermostRepo(repos, dir);
      if (gitOwner) {
        ownerByDir.set(dir, gitOwner);
        continue;
      }
      const ownerDir = ownerDirFor(dir, projectDirNames);
      let synthetic = repoById.get(ownerDir);
      if (!synthetic) {
        synthetic = syntheticRepo(ownerDir);
        repoById.set(ownerDir, synthetic);
        repos.push(synthetic);
      }
      ownerByDir.set(dir, synthetic);
    }

    const projectTasks: Promise<SkillInstance>[] = [];
    for (let index = 0; index < agentDirs.length; index += 1) {
      const dir = agentDirs[index];
      const refs = projectRefLists[index];
      if (!dir || !refs || refs.length === 0) {
        continue;
      }
      const repo = ownerByDir.get(dir);
      if (!repo) {
        continue;
      }
      const readers = readersForProjectDir(agents, repo.gitRoot, dir);
      let nestedDir = '';
      if (dir.startsWith(`${repo.gitRoot}/`)) {
        const rel = dir.slice(repo.gitRoot.length + 1);
        const segments = rel.split('/');
        if (segments.length > 2) {
          nestedDir = segments.slice(0, segments.length - 2).join('/');
        }
      }
      for (const ref of refs) {
        projectTasks.push(
          buildInstance({
            ref,
            scope: 'project',
            readers,
            repoId: repo.id,
            nestedDir,
            isHub: false,
            pluginName: '',
            pluginVersion: ''
          })
        );
      }
    }

    const pluginRefLists = await Promise.all(plugins.dirs.map((dir) => readSkillDirs(dir.parentDir)));
    const pluginTasks: Promise<SkillInstance>[] = [];
    for (let index = 0; index < plugins.dirs.length; index += 1) {
      const dir = plugins.dirs[index];
      const refs = pluginRefLists[index];
      if (!dir || !refs) {
        continue;
      }
      for (const ref of refs) {
        pluginTasks.push(
          buildInstance({
            ref,
            scope: 'plugin',
            readers: ['claude-code'],
            repoId: '',
            nestedDir: '',
            isHub: false,
            pluginName: dir.pluginName,
            pluginVersion: dir.version
          })
        );
      }
    }

    const allInstances = await Promise.all([...globalTasks, ...projectTasks, ...pluginTasks]);

    const pathsByRepo = new Map<string, string[]>();
    for (const instance of allInstances) {
      if (instance.scope !== 'project') {
        continue;
      }
      const bucket = pathsByRepo.get(instance.repoId);
      if (bucket) {
        bucket.push(instance.absPath);
        continue;
      }
      pathsByRepo.set(instance.repoId, [instance.absPath]);
    }
    const gitEntries = [...pathsByRepo.entries()];
    const gitResults = await Promise.all(
      gitEntries.map(async (entry) => {
        const repo = repoById.get(entry[0]);
        if (!repo) {
          return {} as Record<string, GitState>;
        }
        return gitStateForPaths(repo, entry[1]);
      })
    );
    const gitByPath: Record<string, GitState> = {};
    for (const result of gitResults) {
      for (const [path, state] of Object.entries(result)) {
        gitByPath[path] = state;
      }
    }
    for (const instance of allInstances) {
      const state = gitByPath[instance.absPath];
      if (state) {
        instance.gitState = state;
      }
    }

    const skills = buildSkills(allInstances, repos, config.hubPath);
    const overrides = await readOverrideState(repos);
    const cells: SkilletIndex['cells'] = {};
    for (const skill of skills) {
      cells[skill.id] = computeCells(skill, agents, repos, overrides, config.showAllAgents);
    }

    const index: SkilletIndex = {
      agents,
      repos,
      skills,
      cells,
      hubPath: config.hubPath,
      scannedAt: new Date().toISOString(),
      stalePluginVersions: plugins.staleVersions,
      scanMs: Date.now() - started
    };
    setIndex(index);
    return index;
  } catch (error) {
    throw new SkilletError({
      message: 'scan failed',
      method: 'scanAll',
      service: SERVICE,
      error
    });
  }
}
