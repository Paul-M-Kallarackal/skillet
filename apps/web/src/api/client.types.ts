type CellState = 'unknown' | 'ask' | 'auto' | 'user-only' | 'model-only' | 'name-only' | 'off' | 'not-linked' | 'n-a';
type InstanceKind = 'canonical' | 'symlink' | 'copy' | 'plugin';
type SkillScope = 'global' | 'project' | 'plugin';
type GitState = 'tracked' | 'modified' | 'untracked' | 'ignored' | 'none';

interface ValidationError {
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

interface SkillInstance {
  codexImplicitAllowed?: boolean;
  policyError?: string;
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

export interface PluginInfo {
  key: string;
  name: string;
  marketplace: string;
  version: string;
  enabled: boolean;
  installPath: string;
  skillNames: string[];
}

export interface StaleCache {
  path: string;
  plugin: string;
  marketplace: string;
  version: string;
  bytes: number;
}

export interface UninstallPreview {
  key: string;
  command: string[];
  skillCount: number;
  applied: boolean;
  output: string;
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
  showAllAgents: boolean;
  plugins: PluginInfo[];
  staleCaches: StaleCache[];
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

export type AppearanceDensity = 'comfortable' | 'compact';

export interface AppearanceConfig {
  preset: string;
  accent: string;
  sidebar: string;
  gradientFrom: string;
  gradientTo: string;
  gradient: boolean;
  density: AppearanceDensity;
}

export interface SkilletConfig {
  hubPath: string;
  projectRoots: string[];
  maxDepth: number;
  ignoreDirs: string[];
  showAllAgents: boolean;
  sidebarAgents: string[] | null;
  sidebarRepos: string[] | null;
  appearance: AppearanceConfig;
  scanRuntimeDirs: boolean;
}

interface TrashedLink {
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

interface AdoptCandidate {
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
  codexImplicitAllowed?: boolean;
  openCodePermission?: string;
  openCodeScope?: 'global' | 'project';
}
