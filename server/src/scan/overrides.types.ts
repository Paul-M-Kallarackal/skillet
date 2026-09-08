export interface OverrideState {
  claudeGlobal: Record<string, string>;
  claudeByRepo: Record<string, Record<string, string>>;
  codexDisabled: string[];
}
