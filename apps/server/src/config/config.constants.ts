import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SkilletConfig } from './config.types';

export const SKILLET_HOME = join(homedir(), '.skillet');
export const CONFIG_PATH = join(SKILLET_HOME, 'config.json');
const HUB_PATH = join(SKILLET_HOME, 'hub');
export const TRASH_PATH = join(SKILLET_HOME, 'trash');
export const JOURNAL_PATH = join(SKILLET_HOME, 'journal.jsonl');

const DEFAULT_IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.venv',
  'chrome-profile',
  '.cache'
];

export const DEFAULT_CONFIG: SkilletConfig = {
  hubPath: HUB_PATH,
  projectRoots: [],
  maxDepth: 6,
  ignoreDirs: DEFAULT_IGNORE_DIRS,
  showAllAgents: false,
  customAgents: []
};
