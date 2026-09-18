import type { Repo } from './git.types';
import type { Skill } from './index.types';
import type { SkillInstance } from './walk.types';

function rank(instance: SkillInstance): number {
  if (instance.isHub) return 0;
  if (instance.scope === 'global' && instance.kind !== 'symlink') return 1;
  if (instance.scope === 'project' && instance.kind !== 'symlink') return 2;
  if (instance.scope !== 'plugin') return 3;
  return 4;
}

/** A location identifies the representative; its content hash determines membership. */
function idFor(instance: SkillInstance): string {
  return `${instance.scope}:${instance.parentDir}:${instance.name}`;
}

export function buildSkills(instances: SkillInstance[], repos: Repo[]): Skill[] {
  const repoNames = new Map(repos.map((repo) => [repo.id, repo.label]));
  const groups = new Map<string, SkillInstance[]>();
  const hashesByName = new Map<string, Set<string>>();
  for (const instance of instances) {
    // Unknown fingerprints remain separate; two failures are not identical content.
    const version = instance.contentHash || instance.id;
    const key = JSON.stringify([instance.name, version]);
    const bucket = groups.get(key) ?? [];
    bucket.push(instance);
    groups.set(key, bucket);
    const hashes = hashesByName.get(instance.name) ?? new Set<string>();
    hashes.add(version);
    hashesByName.set(instance.name, hashes);
  }

  const globalNames = new Set(instances.filter((instance) => instance.scope === 'global').map((instance) => instance.name));
  const skills: Skill[] = [];
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => rank(a) - rank(b) || a.absPath.localeCompare(b.absPath));
    const canonical = bucket[0]!;
    skills.push({
      id: idFor(canonical),
      name: canonical.name,
      // These describe the representative only. Scope and access belong to each installation.
      scope: canonical.scope,
      repoId: canonical.repoId,
      repoName: repoNames.get(canonical.repoId) ?? '',
      canonicalId: canonical.id,
      description: canonical.frontmatter.description,
      instances: bucket,
      diverged: (hashesByName.get(canonical.name)?.size ?? 0) > 1,
      shadowed: canonical.scope !== 'global' && globalNames.has(canonical.name),
      pluginName: canonical.pluginName,
      errors: canonical.errors
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
