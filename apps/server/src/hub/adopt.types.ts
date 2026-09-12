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

export interface AdoptDecision {
  name: string;
  winnerInstanceId: string;
  linkAgents: string[];
}
