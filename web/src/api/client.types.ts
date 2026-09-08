export type CellState = 'auto' | 'user-only' | 'model-only' | 'name-only' | 'off' | 'not-linked' | 'n-a';
export type InstanceKind = 'canonical' | 'symlink' | 'copy' | 'plugin';
export type SkillScope = 'global' | 'project' | 'plugin';
export type GitState = 'tracked' | 'modified' | 'untracked' | 'ignored' | 'none';

export interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  paths: string[];
  disableModelInvocation: boolean;
  userInvocable: boolean;
  allowedTools: string;
  disallowedTools: string;
  license: string;
  compatibility: string;
  model: string;
  agent: string;
  context: string;
  metadata: Record<string, string>;
  extras: Record<string, unknown>;
  presentKeys: string[];
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

export interface VisibilityCell {
  agentId: string;
  agentName: string;
  state: CellState;
  conditions: string[];
  instanceId: string;
}

export interface Agent {
  id: string;
  name: string;
  projectDir: string;
  resolvedGlobalDir: string;
  installed: boolean;
  custom: boolean;
  overrideSource: 'claude' | 'codex' | 'none';
}

export interface Repo {
  id: string;
  name: string;
  label: string;
  gitRoot: string;
  branch: string;
  isWorktree: boolean;
  mainCheckout: string;
  dirty: boolean;
  worktreeIds: string[];
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

export interface FsStep {
  op: string;
  from: string;
  to: string;
  content: string;
  relative: boolean;
  note: string;
}

export interface OpResult {
  steps: FsStep[];
  applied: boolean;
  journalId: string;
}

export interface SkilletConfig {
  hubPath: string;
  projectRoots: string[];
  maxDepth: number;
  ignoreDirs: string[];
  showAllAgents: boolean;
  scanRuntimeDirs: boolean;
}

export interface TrashedLink {
  path: string;
  relative: boolean;
}

export interface TrashEntry {
  id: string;
  name: string;
  trashedAt: string;
  originPath: string;
  trashPath: string;
  removedLinks: TrashedLink[];
}

export interface JournalEntry {
  id: string;
  at: string;
  action: string;
  skillId: string;
  steps: FsStep[];
  inverse: FsStep[];
}

export interface AdoptCandidate {
  instanceId: string;
  absPath: string;
  contentHash: string;
  readers: string[];
  isSymlink: boolean;
}

export interface AdoptGroup {
  name: string;
  candidates: AdoptCandidate[];
  hashes: string[];
  conflict: boolean;
  suggestedInstanceId: string;
  alreadyInHub: boolean;
}

export interface AdoptPlan {
  hubPath: string;
  groups: AdoptGroup[];
  identicalGroups: number;
  conflictGroups: number;
}

export interface AdoptDecisionInput {
  name: string;
  winnerInstanceId: string;
  linkAgents: string[];
}

export interface LinkTarget {
  agentId: string;
  scope: 'global' | 'project';
  repoId: string;
}

export interface TriggerChanges {
  disableModelInvocation: boolean;
  userInvocable: boolean;
  paths: string[];
  claudeOverride: string;
  claudeOverrideScope: 'global' | 'project';
  codexEnabled: boolean;
}
