import { Check } from 'lucide-react';
import type { ThemePreset } from '../../theme/theme.types';

export function ThemeCard({ preset, selected, onSelect }: { preset: ThemePreset; selected: boolean; onSelect: () => void }) {
  let className = 'shell-theme-card';
  if (selected) {
    className += ' is-selected';
  }
  return (
    <button type="button" className={className} aria-pressed={selected} onClick={onSelect}>
      <span className="shell-theme-preview" aria-hidden="true">
        <span className="shell-theme-preview-sidebar" style={{ background: preset.sidebar }}><span style={{ background: preset.accent }} /><span /></span>
        <span className="shell-theme-preview-canvas" style={{ backgroundImage: `linear-gradient(135deg, ${preset.gradientFrom} 30%, ${preset.gradientTo} 100%)` }}><span /><span /><span className="shell-theme-preview-pill" style={{ background: preset.accent }} /></span>
      </span>
      <span className="shell-theme-name">{preset.name}{selected && <Check aria-hidden="true" />}</span>
    </button>
  );
}
