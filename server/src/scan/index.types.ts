import type { Agent } from '../registry/agents.types';
import type { VisibilityCell } from '../visibility/visibility.types';
import type { Repo } from './git.types';
import type { ValidationError } from './frontmatter.types';
import type { SkillInstance, SkillScope } from './walk.types';

export interface Skill {
  id: string;
  name: string;
  scope: SkillScope;
  repoId: string;
  repoName: string;
  canonicalId: string;
  description: string;
  instances: SkillInstance[];
  diverged: boolean;
  shadowed: boolean;
  pluginName: string;
  errors: ValidationError[];
}

export interface SkilletIndex {
  agents: Agent[];
  repos: Repo[];
  skills: Skill[];
  cells: Record<string, VisibilityCell[]>;
  hubPath: string;
  scannedAt: string;
  stalePluginVersions: number;
  scanMs: number;
}
