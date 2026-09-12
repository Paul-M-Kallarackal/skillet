import type { OpenCodePolicy } from './opencode-policy';

export interface OverrideState {
  claudeGlobal: Record<string, string>;
  claudeByRepo: Record<string, Record<string, string>>;
  codexDisabled: string[];
  codexError?: boolean;
  openCodeGlobal?: OpenCodePolicy;
  openCodeByRepo?: Record<string, OpenCodePolicy>;
}
