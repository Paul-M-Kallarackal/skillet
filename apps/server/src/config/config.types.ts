import type { AgentDefinition } from '../registry/agents.types';

type AppearanceDensity = 'comfortable' | 'compact';

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
  customAgents: AgentDefinition[];
  scanRuntimeDirs: boolean;
}
