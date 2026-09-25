import type { AppearanceConfig, AppearanceDensity } from '../api/client.types';
import { ACCENT_INK_BASE, DEFAULT_APPEARANCE, INK, ON_ACCENT_BASE, THEME_PRESETS } from './theme.constants';

function channels(hex: string): number[] {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function toHex(values: number[]): string {
  let out = '#';
  for (const value of values) {
    out += Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
  }
  return out.toUpperCase();
}

/** Mix `to` into `from` by `weight` (0 keeps `from`, 1 gives `to`). */
function mixHex(from: string, to: string, weight: number): string {
  const a = channels(from);
  const b = channels(to);
  const mixed: number[] = [];
  for (let position = 0; position < 3; position += 1) {
    const start = a[position] ?? 0;
    const end = b[position] ?? 0;
    mixed.push(start + (end - start) * weight);
  }
  return toHex(mixed);
}

function deriveShellTokens(appearance: AppearanceConfig): Record<string, string> {
  let canvasImage = 'none';
  if (appearance.gradient) {
    canvasImage = `linear-gradient(135deg, ${appearance.gradientFrom} 30%, ${appearance.gradientTo} 100%)`;
  }
  return {
    '--shell-canvas': appearance.gradientFrom,
    '--shell-canvas-image': canvasImage,
    '--shell-sidebar': appearance.sidebar,
    '--shell-hover': mixHex(appearance.sidebar, appearance.accent, 0.35),
    '--shell-selected': mixHex(appearance.sidebar, appearance.accent, 0.6),
    '--shell-hairline': mixHex(appearance.sidebar, INK, 0.07),
    '--shell-control': mixHex(appearance.sidebar, INK, 0.16),
    '--shell-accent': appearance.accent,
    '--shell-accent-hover': mixHex(appearance.accent, INK, 0.08),
    '--shell-accent-soft': mixHex('#FFFFFF', appearance.accent, 0.45),
    '--shell-accent-ink': mixHex(appearance.accent, ACCENT_INK_BASE, 0.6),
    '--shell-on-accent': mixHex(appearance.accent, ON_ACCENT_BASE, 0.8),
    '--shell-gradient-from': appearance.gradientFrom,
    '--shell-gradient-to': appearance.gradientTo
  };
}

export function applyAppearance(appearance: AppearanceConfig): void {
  const root = document.documentElement;
  const tokens = deriveShellTokens(appearance);
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }
  root.dataset.density = appearance.density;
}

export function presetAppearance(presetId: string, density: AppearanceDensity, gradient: boolean): AppearanceConfig {
  let appearance: AppearanceConfig = { ...DEFAULT_APPEARANCE, density, gradient };
  for (const preset of THEME_PRESETS) {
    if (preset.id === presetId) {
      appearance = {
        preset: preset.id,
        accent: preset.accent,
        sidebar: preset.sidebar,
        gradientFrom: preset.gradientFrom,
        gradientTo: preset.gradientTo,
        gradient,
        density
      };
    }
  }
  return appearance;
}
