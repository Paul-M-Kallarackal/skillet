import type { AgentDefinition } from '../registry/agents.types';

export interface SkilletConfig {
  hubPath: string;
  projectRoots: string[];
  maxDepth: number;
  ignoreDirs: string[];
  showAllAgents: boolean;
  customAgents: AgentDefinition[];
}
