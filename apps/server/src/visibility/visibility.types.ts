export type CellState = 'unknown' | 'ask' | 'auto' | 'user-only' | 'model-only' | 'name-only' | 'off' | 'not-linked' | 'n-a';

export interface VisibilityCell {
  agentId: string;
  agentName: string;
  state: CellState;
  conditions: string[];
  instanceId: string;
}
