import { useRef, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import type { AppearanceConfig, AppearanceDensity } from '../../api/client.types';
import { ColourField } from '../../components/shell/ColourField';
import { SegmentedTabs } from '../../components/shell/SegmentedTabs';
import { SettingRow } from '../../components/shell/SettingRow';
import { Switch } from '../../components/shell/Switch';
import { ThemeCard } from '../../components/shell/ThemeCard';
import { useToast } from '../../components/Toaster';
import { applyAppearance, presetAppearance } from '../../theme/theme';
import { CUSTOM_PRESET_ID, DEFAULT_APPEARANCE, THEME_PRESETS } from '../../theme/theme.constants';

const SAVE_DELAY_MS = 400;

export function AppearanceSettings({ initial }: { initial: AppearanceConfig }) {
  const toast = useToast();
  const [appearance, setAppearance] = useState<AppearanceConfig>(initial);
  const timer = useRef<number>(0);

  const persist = (next: AppearanceConfig) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api.putConfig({ appearance: next }).catch((cause: unknown) => toast.push(errorMessage(cause, 'could not save theme; it stays applied until reload'), 'error'));
    }, SAVE_DELAY_MS);
  };

  const update = (next: AppearanceConfig) => {
    setAppearance(next);
    applyAppearance(next);
    persist(next);
  };

  const editColour = (key: 'accent' | 'sidebar' | 'gradientFrom' | 'gradientTo', value: string) => {
    update({ ...appearance, [key]: value, preset: CUSTOM_PRESET_ID });
  };

  const exportTheme = () => {
    const blob = new Blob([`${JSON.stringify(appearance, null, 2)}\n`], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'skillet-theme.json';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="shell-appearance">
      <div className="shell-appearance-head"><h2>Theme</h2><span>Presets set every colour below. Edit any of them to make it yours.</span></div>
      <div className="shell-theme-grid">
        {THEME_PRESETS.map((preset) => (
          <ThemeCard key={preset.id} preset={preset} selected={appearance.preset === preset.id} onSelect={() => update(presetAppearance(preset.id, appearance.density, appearance.gradient))} />
        ))}
      </div>
      <SettingRow title="Accent" description="Selected rows, primary buttons, focus ring.">
        <ColourField label="Accent" value={appearance.accent} onChange={(value) => editColour('accent', value)} />
      </SettingRow>
      <SettingRow title="Sidebar" description="Background of the left panel.">
        <ColourField label="Sidebar" value={appearance.sidebar} onChange={(value) => editColour('sidebar', value)} />
      </SettingRow>
      <SettingRow title="Background gradient" description="Canvas behind pages. Turn off for a flat colour.">
        <ColourField label="Gradient start" value={appearance.gradientFrom} onChange={(value) => editColour('gradientFrom', value)} />
        <span aria-hidden="true">→</span>
        <ColourField label="Gradient end" value={appearance.gradientTo} onChange={(value) => editColour('gradientTo', value)} />
        <Switch label="Use gradient background" checked={appearance.gradient} onChange={(gradient) => update({ ...appearance, gradient })} />
      </SettingRow>
      <SettingRow title="Density" description="Row height in the sidebar and lists.">
        <SegmentedTabs<AppearanceDensity> label="Density" value={appearance.density} onChange={(density) => update({ ...appearance, density })} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
      </SettingRow>
      <div className="shell-appearance-foot">
        <span>Theme is saved per machine. Export it to share with your team.</span>
        <button type="button" className="button-link" onClick={exportTheme}>Export theme</button>
        <button type="button" onClick={() => update({ ...DEFAULT_APPEARANCE })}>Reset to Straw</button>
      </div>
    </div>
  );
}
