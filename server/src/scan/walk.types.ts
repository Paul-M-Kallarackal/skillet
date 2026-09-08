import type { SkillFrontmatter, ValidationError } from './frontmatter.types';

export type InstanceKind = 'canonical' | 'symlink' | 'copy' | 'plugin';
export type SkillScope = 'global' | 'project' | 'plugin';
export type GitState = 'tracked' | 'modified' | 'untracked' | 'ignored' | 'none';

export interface SkillDirRef {
  name: string;
  absPath: string;
  isSymlink: boolean;
  symlinkTarget: string;
}

export interface SkillInstance {
  id: string;
  name: string;
  absPath: string;
  parentDir: string;
  kind: InstanceKind;
  scope: SkillScope;
  readers: string[];
  repoId: string;
  nestedDir: string;
  symlinkTarget: string;
  contentHash: string;
  frontmatter: SkillFrontmatter;
  body: string;
  files: string[];
  gitState: GitState;
  errors: ValidationError[];
  pluginName: string;
  pluginVersion: string;
  isHub: boolean;
}

export interface BuildInstanceInput {
  ref: SkillDirRef;
  scope: SkillScope;
  readers: string[];
  repoId: string;
  nestedDir: string;
  isHub: boolean;
  pluginName: string;
  pluginVersion: string;
}
