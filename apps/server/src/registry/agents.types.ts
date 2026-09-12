export type OverrideSource = 'claude' | 'codex' | 'none';

export interface AgentDefinition {
  id: string;
  name: string;
  globalDir: string;
  projectDir: string;
  legacyGlobalDirs: string[];
  legacyProjectDirs: string[];
  detect: string[];
  overrideSource: OverrideSource;
}

export interface Agent extends AgentDefinition {
  resolvedGlobalDir: string;
  resolvedLegacyGlobalDirs: string[];
  installed: boolean;
  custom: boolean;
}
