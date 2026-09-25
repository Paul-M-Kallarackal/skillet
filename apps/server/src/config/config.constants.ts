import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AppearanceConfig, SkilletConfig } from './config.types';

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

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  preset: 'straw',
  accent: '#E8DBAE',
  sidebar: '#FAF8F1',
  gradientFrom: '#FEFDF9',
  gradientTo: '#FAF5EE',
  gradient: true,
  density: 'comfortable'
};

export const UI_ONLY_CONFIG_KEYS = ['sidebarAgents', 'sidebarRepos', 'appearance'];

export const DEFAULT_CONFIG: SkilletConfig = {
  hubPath: HUB_PATH,
  projectRoots: [],
  maxDepth: 6,
  ignoreDirs: DEFAULT_IGNORE_DIRS,
  showAllAgents: false,
  sidebarAgents: null,
  sidebarRepos: null,
  appearance: DEFAULT_APPEARANCE,
  customAgents: []
};
