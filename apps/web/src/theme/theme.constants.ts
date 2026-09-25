import type { AppearanceConfig } from '../api/client.types';
import type { ThemePreset } from './theme.types';

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'straw', name: 'Straw', accent: '#E8DBAE', sidebar: '#FAF8F1', gradientFrom: '#FEFDF9', gradientTo: '#FAF5EE' },
  { id: 'lemon', name: 'Lemon', accent: '#FFE67A', sidebar: '#FFFCEE', gradientFrom: '#FFFEF8', gradientTo: '#FFF4F9' },
  { id: 'sage', name: 'Sage', accent: '#C9D8BF', sidebar: '#F4F6F1', gradientFrom: '#FBFCF9', gradientTo: '#EEF3EA' },
  { id: 'sky', name: 'Sky', accent: '#C7D7EE', sidebar: '#F3F6FA', gradientFrom: '#FBFCFE', gradientTo: '#EDF2FA' },
  { id: 'clay', name: 'Clay', accent: '#E3B9A6', sidebar: '#F3F1EA', gradientFrom: '#FAF9F5', gradientTo: '#F6EEE8' },
  { id: 'graphite', name: 'Graphite', accent: '#D5D6DA', sidebar: '#F2F2F3', gradientFrom: '#FBFBFB', gradientTo: '#F1F1F3' }
];

export const CUSTOM_PRESET_ID = 'custom';

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  preset: 'straw',
  accent: '#E8DBAE',
  sidebar: '#FAF8F1',
  gradientFrom: '#FEFDF9',
  gradientTo: '#FAF5EE',
  gradient: true,
  density: 'comfortable'
};

export const INK = '#28303D';
export const ACCENT_INK_BASE = '#3B2A00';
export const ON_ACCENT_BASE = '#1F1500';
