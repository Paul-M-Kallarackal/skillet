import type { OpResult, SkilletIndex } from '../../api/client.types';

export type StepKind = 'skill' | 'agent' | 'destination' | 'project' | 'text';

interface CommandStep {
  kind: StepKind;
  prompt: string;
  /** Menu heading for this step, e.g. "Link to agent". */
  title: string;
  /** Word shown in the bar before this step's input, e.g. "to". */
  connector?: string;
}

export interface PickedValue {
  id: string;
  label: string;
}

export interface CommandContext {
  index: SkilletIndex;
  navigate: (path: string) => void;
  setParam: (key: string, value: string) => void;
  refresh: () => void;
}

export interface CommandDefinition {
  id: string;
  summary: string;
  steps: CommandStep[];
  /** Mutating commands return an operation; dryRun true builds the preview. */
  mutate?: (values: PickedValue[], dryRun: boolean) => Promise<OpResult>;
  /** Non-mutating commands act immediately. */
  act?: (values: PickedValue[], context: CommandContext) => Promise<string>;
}

type MenuIcon = 'agent' | 'folder' | 'command' | 'none';

export interface MenuOption {
  id: string;
  label: string;
  meta: string;
  icon: MenuIcon;
}
