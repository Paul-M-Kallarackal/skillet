import type { Repo } from './git.types';
import type { Skill } from './index.types';
import type { SkillInstance } from './walk.types';

function keyFor(instance: SkillInstance): string {
  if (instance.scope === 'plugin') {
    return `plugin:${instance.pluginName}:${instance.name}`;
  }
  if (instance.scope === 'project') {
    return `project:${instance.repoId}:${instance.name}`;
  }
  return `global:${instance.name}`;
}

function pickCanonical(instances: SkillInstance[], hubPath: string): SkillInstance {
  const head = instances[0];
  if (!head) {
    throw new Error('pickCanonical received an empty instance list');
  }
  let best = head;
  for (const instance of instances) {
    if (instance.isHub) {
      return instance;
    }
  }
  for (const instance of instances) {
    if (instance.kind === 'canonical' && instance.absPath.startsWith(hubPath)) {
      return instance;
    }
  }
  for (const instance of instances) {
    if (instance.kind === 'canonical' || instance.kind === 'plugin') {
      best = instance;
      break;
    }
  }
  return best;
}

export function buildSkills(instances: SkillInstance[], repos: Repo[], hubPath: string): Skill[] {
  const repoNames = new Map<string, string>();
  for (const repo of repos) {
    repoNames.set(repo.id, repo.label);
  }

  const groups = new Map<string, SkillInstance[]>();
  for (const instance of instances) {
    const key = keyFor(instance);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(instance);
      continue;
    }
    groups.set(key, [instance]);
  }

  const globalNames = new Set<string>();
  for (const instance of instances) {
    if (instance.scope === 'global') {
      globalNames.add(instance.name);
    }
  }

  const skills: Skill[] = [];
  for (const [key, bucket] of groups) {
    const canonical = pickCanonical(bucket, hubPath);
    const hashes = new Set<string>();
    for (const instance of bucket) {
      if (instance.kind === 'symlink') {
        continue;
      }
      hashes.add(instance.contentHash);
    }
    let repoName = '';
    const mapped = repoNames.get(canonical.repoId);
    if (mapped) {
      repoName = mapped;
    }
    let shadowed = false;
    if (canonical.scope !== 'global' && globalNames.has(canonical.name)) {
      shadowed = true;
    }
    skills.push({
      id: key,
      name: canonical.name,
      scope: canonical.scope,
      repoId: canonical.repoId,
      repoName,
      canonicalId: canonical.id,
      description: canonical.frontmatter.description,
      instances: bucket,
      diverged: hashes.size > 1,
      shadowed,
      pluginName: canonical.pluginName,
      errors: canonical.errors
    });
  }

  skills.sort((a, b) => {
    if (a.name === b.name) {
      return a.scope.localeCompare(b.scope);
    }
    return a.name.localeCompare(b.name);
  });
  return skills;
}
