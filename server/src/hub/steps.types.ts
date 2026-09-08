export type FsStepOp =
  | 'mkdir'
  | 'move'
  | 'symlink'
  | 'unlink'
  | 'writeFile'
  | 'copyDir'
  | 'removeDir';

export interface FsStep {
  op: FsStepOp;
  from: string;
  to: string;
  content: string;
  relative: boolean;
  note: string;
}

export interface JournalEntryInput {
  action: string;
  skillId: string;
  steps: FsStep[];
}

export interface JournalEntry extends JournalEntryInput {
  id: string;
  at: string;
  inverse: FsStep[];
}

export interface OpResult {
  steps: FsStep[];
  applied: boolean;
  journalId: string;
}
