# Claude-style Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Skillet's UI as a Claude-style shell (dense sidebar with agents and projects, bottom search-and-command bar, muted-yellow themeable look) from a set of reusable components that match the Paper library.

**Architecture:** A `--shell-*` token layer (`styles/shell.css`) is written at runtime by `theme/theme.ts` from `config.appearance`, and the legacy `--ui-*` roles are aliased to it so untouched pages re-theme too. Reusable components live in `components/shell/` (one file per Paper library page). The sidebar, command bar, skills list and settings are then recomposed from those components. The server only gains two config fields and a no-rescan fast path.

**Tech Stack:** Bun 1.3 workspace, React 19 + react-router, Hono server, lucide-react icons, plain CSS files.

**Spec:** `docs/superpowers/specs/2026-09-25-claude-style-shell-design.md`
**Design reference:** Paper file "Skillet — 0.0.4" page "0.1.0 — Claude shell"; Paper file "Components — Shared UI Library" pages `Shell · Group / Name`.

## Global Constraints

- No new test or spec files (repository owner instruction). Verification is `bun run typecheck`, `bun run lint`, `bun run deadcode`, `bun run build`, and Chrome screenshots.
- No ternaries where an `if` works; never nested ternaries.
- Never build an array with `.filter(...).map(...)`; use a `for...of` loop with `push`.
- Never `await` inside a loop.
- Async functions wrap their body in `try`/`catch` and rethrow a `SkilletError` (server) with `message`, `method`, `service`, `error`.
- No explicit `undefined` types and no `any`.
- No AI calls, no send button, nothing leaves the machine.
- Light mode only; themes are light.
- System sans font for the app (AGENTS.md).
- Browser checks only exercise read-only flows; commands are verified up to the preview dialog.
- Sample data in screenshots stays whatever the local scan shows; do not paste screenshots with work repositories into shared docs.

## Review Focus

- Hand-edited `~/.skillet/config.json` with a bad hex (`"accent": "yellow"`) must fall back to Straw values, not break the page. Owned by Task 1 (merge validation).
- Saving appearance while the server is down must keep the chosen theme applied locally and show an error toast, not silently lose it. Owned by Task 7.
- `localStorage` throwing (private window) must not break sidebar collapse or section collapse. Owned by Task 4 (`readFlag` / `writeFlag`).
- `⌘K` while a dialog is open must not steal focus from the dialog. Owned by Task 5.
- Hiding every agent and project must leave a visible way back (`Choose agents` / `Choose projects`). Owned by Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/server/src/config/config.types.ts` | `AppearanceConfig`, `sidebarRepos`, `appearance` on `SkilletConfig` |
| `apps/server/src/config/config.constants.ts` | `DEFAULT_APPEARANCE` (Straw) |
| `apps/server/src/config/config.ts` | merge + validate new fields |
| `apps/server/src/routes/config-route.ts` | skip rescan for UI-only patches |
| `apps/web/src/api/client.types.ts` | mirror config types |
| `apps/web/src/theme/theme.types.ts` | `ThemePreset` |
| `apps/web/src/theme/theme.constants.ts` | six presets, default appearance |
| `apps/web/src/theme/theme.ts` | colour maths, `deriveShellTokens`, `applyAppearance` |
| `apps/web/src/theme/useAppearanceBoot.ts` | load config once and apply theme |
| `apps/web/src/styles/shell.css` | `--shell-*` defaults, `--ui-*` aliases, all shell component styles |
| `apps/web/src/components/shell/*.tsx` | one component per Paper library page |
| `apps/web/src/components/shell/sidebar-state.ts` | default/visible agent and project rules |
| `apps/web/src/components/shell/useSidebarConfig.ts` | load/save `sidebarAgents` + `sidebarRepos` |
| `apps/web/src/components/command-bar/*` | command bar, menu, commands, chips |
| `apps/web/src/components/Sidebar.tsx` | composition only |
| `apps/web/src/pages/SkillsPage.tsx` | reads `?q=`, renders `SkillRow` list |
| `apps/web/src/pages/SettingsPage.tsx` | tabs; General/Scanning keep current fields |
| `apps/web/src/pages/settings/AppearanceSettings.tsx` | Appearance tab |
| Deleted: `CommandPalette.tsx`, `SidebarAgentFilters.tsx`, `SkillCards.tsx` | replaced |

---

### Task 1: Server config — sidebarRepos, appearance, fast path

**Files:**
- Modify: `apps/server/src/config/config.types.ts`
- Modify: `apps/server/src/config/config.constants.ts`
- Modify: `apps/server/src/config/config.ts`
- Modify: `apps/server/src/routes/config-route.ts`
- Modify: `apps/web/src/api/client.types.ts`

**Interfaces:**
- Produces: `SkilletConfig.sidebarRepos: string[] | null`, `SkilletConfig.appearance: AppearanceConfig` on server and client; `PUT /api/config` with only UI keys returns `{ config, scannedAt: null }` without rescanning.

- [ ] **Step 1: Types**

```ts
// file: apps/server/src/config/config.types.ts
import type { AgentDefinition } from '../registry/agents.types';

export type AppearanceDensity = 'comfortable' | 'compact';

export interface AppearanceConfig {
  preset: string;
  accent: string;
  sidebar: string;
  gradientFrom: string;
  gradientTo: string;
  gradient: boolean;
  density: AppearanceDensity;
}

export interface SkilletConfig {
  hubPath: string;
  projectRoots: string[];
  maxDepth: number;
  ignoreDirs: string[];
  showAllAgents: boolean;
  sidebarAgents: string[] | null;
  sidebarRepos: string[] | null;
  appearance: AppearanceConfig;
  customAgents: AgentDefinition[];
  scanRuntimeDirs: boolean;
}
```

- [ ] **Step 2: Defaults** — in `config.constants.ts`, change the type import to `import type { AppearanceConfig, SkilletConfig } from './config.types';`, add before `DEFAULT_CONFIG`:

```ts
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
```

and add `sidebarRepos: null,` and `appearance: DEFAULT_APPEARANCE,` to `DEFAULT_CONFIG` after `sidebarAgents: null,`.

- [ ] **Step 3: Merge + validation** — in `config.ts`, import `DEFAULT_APPEARANCE` from `./config.constants` and `AppearanceConfig` type; add these helpers above `merge`:

```ts
const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

function readStringList(value: unknown): string[] {
  const out: string[] = [];
  if (!Array.isArray(value)) {
    return out;
  }
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      out.push(entry);
    }
  }
  return out;
}

function readHex(value: unknown, fallback: string): string {
  if (typeof value === 'string' && HEX_COLOUR.test(value)) {
    return value.toUpperCase();
  }
  return fallback;
}

function mergeAppearance(raw: unknown): AppearanceConfig {
  const merged: AppearanceConfig = { ...DEFAULT_APPEARANCE };
  if (!raw || typeof raw !== 'object') {
    return merged;
  }
  const source = raw as Record<string, unknown>;
  if (typeof source.preset === 'string' && source.preset.length > 0) {
    merged.preset = source.preset;
  }
  merged.accent = readHex(source.accent, DEFAULT_APPEARANCE.accent);
  merged.sidebar = readHex(source.sidebar, DEFAULT_APPEARANCE.sidebar);
  merged.gradientFrom = readHex(source.gradientFrom, DEFAULT_APPEARANCE.gradientFrom);
  merged.gradientTo = readHex(source.gradientTo, DEFAULT_APPEARANCE.gradientTo);
  if (typeof source.gradient === 'boolean') {
    merged.gradient = source.gradient;
  }
  if (source.density === 'compact') {
    merged.density = 'compact';
  }
  return merged;
}
```

Replace the existing `sidebarAgents` block in `merge` with:

```ts
  if (Array.isArray(raw.sidebarAgents)) {
    merged.sidebarAgents = readStringList(raw.sidebarAgents);
  }
  if (Array.isArray(raw.sidebarRepos)) {
    merged.sidebarRepos = readStringList(raw.sidebarRepos);
  }
  merged.appearance = mergeAppearance(raw.appearance);
```

and in `saveConfig` validate the patched appearance: replace `const next: SkilletConfig = { ...current, ...patch };` with

```ts
    const next: SkilletConfig = { ...current, ...patch };
    next.appearance = mergeAppearance(next.appearance);
```

- [ ] **Step 4: Fast path** — in `config-route.ts` import `UI_ONLY_CONFIG_KEYS` and replace the sidebar-only check with:

```ts
    const patchKeys = Object.keys(body.patch);
    let uiOnly = patchKeys.length > 0;
    for (const key of patchKeys) {
      if (!UI_ONLY_CONFIG_KEYS.includes(key)) {
        uiOnly = false;
      }
    }
    if (uiOnly) {
      return c.json({ config, scannedAt: null });
    }
```

- [ ] **Step 5: Client types** — in `apps/web/src/api/client.types.ts` add above `SkilletConfig`:

```ts
export type AppearanceDensity = 'comfortable' | 'compact';

export interface AppearanceConfig {
  preset: string;
  accent: string;
  sidebar: string;
  gradientFrom: string;
  gradientTo: string;
  gradient: boolean;
  density: AppearanceDensity;
}
```

and add `sidebarRepos: string[] | null;` and `appearance: AppearanceConfig;` to `SkilletConfig`.

- [ ] **Step 6: Verify** — Run: `bun run typecheck` → both workspaces exit 0. Run: `curl -s localhost:5181/api/config | grep -o '"appearance":{[^}]*}'` → Straw values. Run `curl -s -X PUT localhost:5181/api/config -H 'content-type: application/json' -H 'x-skillet-client: skillet-web' -d '{"patch":{"appearance":{"accent":"yellow"}}}'` → returns accent `#E8DBAE` and `"scannedAt":null`.

---

### Task 2: Theme engine, shell tokens, logos

**Files:**
- Create: `apps/web/src/theme/theme.types.ts`, `theme.constants.ts`, `theme.ts`, `useAppearanceBoot.ts`
- Create: `apps/web/src/styles/shell.css`
- Modify: `apps/web/src/main.tsx` (import shell.css last)
- Modify: `apps/web/src/components/AgentIcon.tsx` (Claude Code uses `claudecode`, add `data-agent`)

**Interfaces:**
- Produces: `THEME_PRESETS: ThemePreset[]`, `DEFAULT_APPEARANCE: AppearanceConfig`, `applyAppearance(appearance: AppearanceConfig): void`, `presetAppearance(presetId: string, density: AppearanceDensity, gradient: boolean): AppearanceConfig`, `useAppearanceBoot(): void`.

- [ ] **Step 1: Theme types and presets**

```ts
// file: apps/web/src/theme/theme.types.ts
export interface ThemePreset {
  id: string;
  name: string;
  accent: string;
  sidebar: string;
  gradientFrom: string;
  gradientTo: string;
}
```

```ts
// file: apps/web/src/theme/theme.constants.ts
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
```

- [ ] **Step 2: Theme maths and apply**

```ts
// file: apps/web/src/theme/theme.ts
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
export function mixHex(from: string, to: string, weight: number): string {
  const a = channels(from);
  const b = channels(to);
  const mixed: number[] = [];
  for (let position = 0; position < 3; position += 1) {
    mixed.push(a[position] + (b[position] - a[position]) * weight);
  }
  return toHex(mixed);
}

export function deriveShellTokens(appearance: AppearanceConfig): Record<string, string> {
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
  for (const name of Object.keys(tokens)) {
    root.style.setProperty(name, tokens[name]);
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
```

```ts
// file: apps/web/src/theme/useAppearanceBoot.ts
import { useEffect } from 'react';
import { api } from '../api/client';
import { applyAppearance } from './theme';

/** Applies the saved theme once on load. The CSS defaults (Straw) cover the time before it arrives. */
export function useAppearanceBoot(): void {
  useEffect(() => {
    api
      .getConfig()
      .then((result) => applyAppearance(result.config.appearance))
      .catch(() => {
        // Keep the Straw defaults from shell.css when the config cannot be read.
      });
  }, []);
}
```

- [ ] **Step 3: shell.css** — create `apps/web/src/styles/shell.css` with the token defaults and aliases below; component styles are appended by later tasks.

```css
/* file: apps/web/src/styles/shell.css */
/* Skillet shell 0.1.0 — tokens mirror Paper "Shell · Foundations / Colour tokens". theme.ts overwrites them at runtime. */
:root {
  --shell-canvas: #FEFDF9;
  --shell-canvas-image: linear-gradient(135deg, #FEFDF9 30%, #FAF5EE 100%);
  --shell-sidebar: #FAF8F1;
  --shell-surface: #FFFFFF;
  --shell-ink: #28303D;
  --shell-ink-2: #515966;
  --shell-muted: #606876;
  --shell-hairline: #ECE8DC;
  --shell-control: #D6D0BE;
  --shell-hover: #F4F0E4;
  --shell-selected: #EEE7D3;
  --shell-accent: #E8DBAE;
  --shell-accent-hover: #DCCFA3;
  --shell-accent-soft: #F4EEDB;
  --shell-accent-ink: #7A6528;
  --shell-on-accent: #463A17;
  --shell-gradient-from: #FEFDF9;
  --shell-gradient-to: #FAF5EE;
  --shell-detected: #15803D;
  --shell-row: 32px;
  --shell-shadow-pop: 0 10px 30px rgba(20, 20, 19, 0.12);

  /* Legacy roles follow the shell so untouched pages re-theme. */
  --ui-canvas: var(--shell-canvas);
  --ui-surface-hover: var(--shell-hover);
  --ui-surface-sunken: var(--shell-hover);
  --ui-surface-active: var(--shell-selected);
  --ui-text: var(--shell-ink);
  --ui-text-secondary: var(--shell-ink-2);
  --ui-text-muted: var(--shell-muted);
  --ui-border: var(--shell-hairline);
  --ui-border-control: var(--shell-control);
  --ui-focus: var(--shell-accent-ink);
  --ui-primary: var(--shell-accent);
  --ui-primary-hover: var(--shell-accent-hover);
  --ui-primary-active: var(--shell-accent-hover);
  --ui-on-primary: var(--shell-on-accent);
  --ui-selection: var(--shell-selected);
  --ui-on-selection: var(--shell-ink);
  --ui-selection-border: var(--shell-accent-ink);
  --ui-gradient-canvas: var(--shell-canvas-image);
  --ui-gradient-surface: linear-gradient(var(--shell-surface), var(--shell-surface));
  --ui-gradient-elevated: linear-gradient(var(--shell-surface), var(--shell-surface));
  --ui-font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

:root[data-density='compact'] { --shell-row: 28px; }

body { background: var(--shell-canvas); color: var(--shell-ink); font-family: var(--ui-font-family); }
```

- [ ] **Step 4: Wire** — add `import './styles/shell.css';` as the last import in `main.tsx`; in `App.tsx` import `useAppearanceBoot` from `../theme/useAppearanceBoot` and call `useAppearanceBoot();` as the first line of `App`.

- [ ] **Step 5: Logos** — in `AgentIcon.tsx` change `'claude-code': 'claude'` to `'claude-code': 'claudecode'` and add `data-agent={id}` to the outer span. Append to `shell.css`:

```css
.agent-icon[data-agent='claude-code'] { color: #D97757; }
.agent-icon[data-agent='kiro-cli'] { color: #9046FF; }
.agent-icon[data-agent='codex'], .agent-icon[data-agent='cursor'], .agent-icon[data-agent='pi'] { color: #000000; }
```

- [ ] **Step 6: Verify** — `bun run typecheck && bun run lint && bun run deadcode` exit 0 (knip may flag `presetAppearance`/`mixHex` until Task 7 uses them; that is expected only at this step). Load http://127.0.0.1:5180 and confirm the canvas is the Straw gradient.

---

### Task 3: Control components (Paper: Shell · Controls / *)

**Files:**
- Create: `apps/web/src/components/shell/Switch.tsx`, `SegmentedTabs.tsx`, `KeyHint.tsx`, `FilterChip.tsx`, `ColourField.tsx`, `ThemeCard.tsx`, `Popover.tsx`
- Modify: `apps/web/src/styles/shell.css` (append control styles)

**Interfaces:**
- Produces:
  - `Switch({ checked, onChange, label, disabled? })`
  - `SegmentedTabs<T extends string>({ value, options: { value: T; label: string }[], onChange, label })`
  - `KeyHint({ children })`
  - `FilterChip({ label, onRemove })`, `AddFilterChip({ onClick })`
  - `ColourField({ label, value, onChange })`
  - `ThemeCard({ preset: ThemePreset, selected, onSelect })`
  - `Popover({ trigger: (props: PopoverTriggerProps) => ReactNode, children, align?: 'start' | 'end', placement?: 'below' | 'above' | 'right' })`, `PopoverItem({ icon?, label, meta?, onSelect })`, `PopoverDivider()`

- [ ] **Step 1: Components**

```tsx
// file: apps/web/src/components/shell/Switch.tsx
export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  let className = 'shell-switch';
  if (checked) {
    className += ' is-on';
  }
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={className} disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="shell-switch-knob" aria-hidden="true" />
    </button>
  );
}
```

```tsx
// file: apps/web/src/components/shell/SegmentedTabs.tsx
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedTabs<T extends string>({ value, options, onChange, label }: { value: T; options: SegmentedOption<T>[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="shell-segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={option.value === value} className="shell-segmented-tab" onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// file: apps/web/src/components/shell/KeyHint.tsx
import type { ReactNode } from 'react';

export function KeyHint({ children }: { children: ReactNode }) {
  return <kbd className="shell-kbd">{children}</kbd>;
}
```

```tsx
// file: apps/web/src/components/shell/FilterChip.tsx
import { Plus, X } from 'lucide-react';

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="shell-chip">
      {label}
      <button type="button" className="shell-chip-remove" aria-label={`Remove filter ${label}`} onClick={onRemove}><X aria-hidden="true" /></button>
    </span>
  );
}

export function AddFilterChip({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="shell-chip shell-chip-add" onClick={onClick}>
      <Plus aria-hidden="true" />Filter
    </button>
  );
}
```

```tsx
// file: apps/web/src/components/shell/ColourField.tsx
import { useEffect, useState } from 'react';

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

export function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (next: string) => {
    let normalized = next.trim();
    if (!normalized.startsWith('#')) {
      normalized = `#${normalized}`;
    }
    if (HEX_COLOUR.test(normalized)) {
      onChange(normalized.toUpperCase());
      return;
    }
    setDraft(value);
  };

  return (
    <span className="shell-colour-field">
      <input type="color" className="shell-colour-swatch" aria-label={`${label} colour picker`} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      <input className="shell-colour-hex" aria-label={`${label} hex value`} value={draft} spellCheck={false} onChange={(event) => setDraft(event.target.value)} onBlur={(event) => commit(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit(event.currentTarget.value);
        }
      }} />
    </span>
  );
}
```

```tsx
// file: apps/web/src/components/shell/ThemeCard.tsx
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
```

```tsx
// file: apps/web/src/components/shell/Popover.tsx
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface PopoverTriggerProps {
  open: boolean;
  toggle: () => void;
}

type PopoverPlacement = 'below' | 'above' | 'right';

export function Popover({ trigger, children, placement = 'below' }: { trigger: (props: PopoverTriggerProps) => ReactNode; children: (close: () => void) => ReactNode; placement?: PopoverPlacement }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        const button = ref.current?.querySelector<HTMLElement>('[data-popover-trigger]');
        button?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="shell-popover-anchor" ref={ref}>
      {trigger({ open, toggle: () => setOpen((current) => !current) })}
      {open && <div className={`shell-popover shell-popover-${placement}`} role="menu">{children(close)}</div>}
    </div>
  );
}

export function PopoverItem({ icon, label, meta, onSelect }: { icon?: ReactNode; label: string; meta?: string; onSelect: () => void }) {
  return (
    <button type="button" role="menuitem" className="shell-menu-item" onClick={onSelect}>
      <span className="shell-menu-icon" aria-hidden="true">{icon}</span>
      <span className="shell-menu-label">{label}</span>
      {meta && <span className="shell-menu-meta">{meta}</span>}
    </button>
  );
}

export function PopoverDivider() {
  return <div className="shell-menu-divider" role="separator" />;
}
```

- [ ] **Step 2: Styles** — append to `shell.css`:

```css
/* Controls — Paper: Shell · Controls / * */
.shell-switch { position: relative; width: 30px; height: 18px; min-height: 0; padding: 2px; border: 0; border-radius: 9px; background: var(--shell-selected); display: inline-flex; flex-shrink: 0; cursor: pointer; }
.shell-switch.is-on { background: var(--shell-ink); justify-content: flex-end; }
.shell-switch-knob { width: 14px; height: 14px; border-radius: 7px; background: #FFFFFF; }
.shell-switch:hover:not(:disabled) { border: 0; }
.shell-segmented { display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--shell-hover); }
.shell-segmented-tab { min-height: 0; padding: 4px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--shell-ink-2); font-size: 13px; }
.shell-segmented-tab[aria-selected='true'] { background: var(--shell-surface); color: var(--shell-ink); font-weight: 500; }
.shell-segmented-tab:hover:not([aria-selected='true']) { border: 0; background: transparent; color: var(--shell-ink); }
.shell-kbd { display: inline-flex; align-items: center; padding: 1px 6px; border: 1px solid var(--shell-hairline); border-radius: 5px; background: var(--shell-canvas); color: var(--shell-ink-2); font: 12px/18px var(--ui-font-family); }
.shell-chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; min-height: 28px; padding: 0 6px 0 10px; border: 1px solid var(--shell-hairline); border-radius: 8px; background: var(--shell-surface); color: var(--shell-ink-2); font-size: 13px; }
.shell-chip-add { padding: 0 10px 0 8px; border-style: dashed; border-color: var(--shell-control); background: transparent; }
.shell-chip svg { width: 13px; height: 13px; }
.shell-chip-remove { display: inline-flex; width: 18px; height: 18px; min-height: 0; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--shell-muted); align-items: center; justify-content: center; }
.shell-colour-field { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px 0 5px; border: 1px solid var(--shell-control); border-radius: 9px; background: var(--shell-surface); }
.shell-colour-swatch { width: 24px; height: 24px; padding: 0; border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 6px; background: none; cursor: pointer; }
.shell-colour-swatch::-webkit-color-swatch-wrapper { padding: 0; }
.shell-colour-swatch::-webkit-color-swatch { border: 0; border-radius: 5px; }
.shell-colour-hex { width: 76px; min-height: 0; padding: 0; border: 0; background: transparent; color: var(--shell-ink); font: 13px ui-monospace, Menlo, monospace; }
.shell-colour-hex:focus { outline: none; }
.shell-theme-card { display: flex; flex-direction: column; gap: 8px; width: 116px; min-height: 0; padding: 0; border: 0; background: transparent; text-align: left; }
.shell-theme-card:hover:not(:disabled) { border: 0; background: transparent; }
.shell-theme-preview { display: flex; height: 76px; overflow: hidden; border: 1px solid var(--shell-hairline); border-radius: 10px; background: #FFFFFF; }
.shell-theme-card.is-selected .shell-theme-preview { border: 2px solid var(--shell-accent-ink); }
.shell-theme-preview-sidebar { display: flex; flex-direction: column; gap: 4px; width: 30px; padding: 8px 5px; border-right: 1px solid rgba(0, 0, 0, 0.06); }
.shell-theme-preview-sidebar span { height: 5px; border-radius: 3px; background: rgba(0, 0, 0, 0.08); }
.shell-theme-preview-canvas { display: flex; flex: 1; flex-direction: column; gap: 5px; padding: 10px 8px; }
.shell-theme-preview-canvas span { height: 5px; border-radius: 3px; background: rgba(0, 0, 0, 0.07); }
.shell-theme-preview-canvas .shell-theme-preview-pill { width: 30px; height: 10px; margin-top: auto; align-self: flex-end; border-radius: 4px; }
.shell-theme-name { display: flex; align-items: center; justify-content: space-between; color: var(--shell-ink); font-size: 13px; font-weight: 500; }
.shell-theme-name svg { width: 14px; height: 14px; color: var(--shell-accent-ink); }
.shell-popover-anchor { position: relative; }
.shell-popover { position: absolute; z-index: 40; min-width: 220px; padding: 5px; border: 1px solid var(--shell-hairline); border-radius: 12px; background: var(--shell-surface); box-shadow: var(--shell-shadow-pop); }
.shell-popover-below { top: calc(100% + 6px); left: 0; }
.shell-popover-above { bottom: calc(100% + 6px); left: 0; }
.shell-popover-right { top: 0; left: calc(100% + 8px); }
.shell-menu-item { display: flex; align-items: center; gap: 10px; width: 100%; height: 34px; min-height: 0; padding: 0 10px; border: 0; border-radius: 7px; background: transparent; color: var(--shell-ink); font-size: 14px; text-align: left; }
.shell-menu-item:hover, .shell-menu-item:focus-visible, .shell-menu-item.is-active { border: 0; background: var(--shell-hover); }
.shell-menu-icon { display: inline-flex; width: 16px; flex-shrink: 0; color: var(--shell-ink-2); }
.shell-menu-icon svg { width: 16px; height: 16px; }
.shell-menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shell-menu-meta { color: var(--shell-muted); font-size: 12px; }
.shell-menu-divider { height: 1px; margin: 5px 6px; background: var(--shell-hairline); }
button.primary { color: var(--shell-on-accent); }
```

- [ ] **Step 3: Verify** — `bun run typecheck && bun run lint` exit 0 (knip reports these as unused until Tasks 4–7 import them).

---

### Task 4: Sidebar components and composition (Paper: Shell · Sidebar / *)

**Files:**
- Create: `apps/web/src/components/shell/SidebarRow.tsx`, `SidebarSection.tsx`, `SidebarHeader.tsx`, `SidebarFooter.tsx`, `SidebarAgents.tsx`, `SidebarProjects.tsx`, `SidebarPickerDialog.tsx`, `sidebar-state.ts`, `useSidebarConfig.ts`, `storage.ts`
- Rewrite: `apps/web/src/components/Sidebar.tsx`
- Delete: `apps/web/src/components/SidebarAgentFilters.tsx`
- Modify: `apps/web/src/styles/shell.css`, remove the `sidebar-agent-*`/`agent-picker-*` rules appended to `agent-icons.css` earlier

**Interfaces:**
- Consumes: `Switch`, `SegmentedTabs`, `Popover`, `PopoverItem`, `PopoverDivider` (Task 3); `api.putConfig` with `sidebarAgents`/`sidebarRepos` (Task 1).
- Produces: `readFlag(key, fallback): boolean`, `writeFlag(key, value): void`; `useSidebarConfig(): { agentIds: string[] | null; repoIds: string[] | null; save(patch: SidebarPatch): Promise<void>; saving: boolean }`; `SidebarRow`; `Sidebar` (default export unchanged name).

- [ ] **Step 1: Storage + state helpers**

```ts
// file: apps/web/src/components/shell/storage.ts
/** Per-viewer UI flags. Storage can be missing or throw (private windows), so every access is guarded. */
export function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    if (value === null) {
      return fallback;
    }
    return value === '1';
  } catch {
    return fallback;
  }
}

export function writeFlag(key: string, value: boolean): void {
  try {
    let stored = '0';
    if (value) {
      stored = '1';
    }
    window.localStorage.setItem(key, stored);
  } catch {
    // Preference is simply not remembered.
  }
}
```

```ts
// file: apps/web/src/components/shell/sidebar-state.ts
import type { Agent, Repo, Skill } from '../../api/client.types';
import { isCommonAgent } from '../common-agents';

export const DEFAULT_VISIBLE_PROJECTS = 8;

export function pickById<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const wanted = new Set(ids);
  const picked: T[] = [];
  for (const item of items) {
    if (wanted.has(item.id)) {
      picked.push(item);
    }
  }
  return picked;
}

export function idsOf<T extends { id: string }>(items: T[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(item.id);
  }
  return ids;
}

export function withoutId(ids: string[], removed: string): string[] {
  const remaining: string[] = [];
  for (const id of ids) {
    if (id !== removed) {
      remaining.push(id);
    }
  }
  return remaining;
}

export function defaultAgents(agents: Agent[]): Agent[] {
  const visible: Agent[] = [];
  for (const agent of agents) {
    if (agent.installed || agent.custom || isCommonAgent(agent.id)) {
      visible.push(agent);
    }
  }
  return visible;
}

export function skillCountByRepo(skills: Skill[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const skill of skills) {
    if (skill.repoId.length > 0) {
      counts.set(skill.repoId, (counts.get(skill.repoId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Default Projects: main checkouts with at least one skill, most skills first. */
export function defaultRepos(repos: Repo[], counts: Map<string, number>): Repo[] {
  const withSkills: Repo[] = [];
  for (const repo of repos) {
    if (!repo.isWorktree && (counts.get(repo.id) ?? 0) > 0) {
      withSkills.push(repo);
    }
  }
  withSkills.sort((left, right) => (counts.get(right.id) ?? 0) - (counts.get(left.id) ?? 0));
  return withSkills;
}
```

```ts
// file: apps/web/src/components/shell/useSidebarConfig.ts
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import { useToast } from '../Toaster';

export interface SidebarPatch {
  sidebarAgents?: string[] | null;
  sidebarRepos?: string[] | null;
}

export function useSidebarConfig() {
  const toast = useToast();
  const [agentIds, setAgentIds] = useState<string[] | null>(null);
  const [repoIds, setRepoIds] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getConfig()
      .then((result) => {
        setAgentIds(result.config.sidebarAgents);
        setRepoIds(result.config.sidebarRepos);
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'could not load sidebar settings'), 'error'));
  }, [toast]);

  const save = useCallback(async (patch: SidebarPatch) => {
    setSaving(true);
    try {
      const result = await api.putConfig(patch);
      setAgentIds(result.config.sidebarAgents);
      setRepoIds(result.config.sidebarRepos);
    } catch (cause) {
      toast.push(errorMessage(cause, 'could not save sidebar'), 'error');
    } finally {
      setSaving(false);
    }
  }, [toast]);

  return { agentIds, repoIds, save, saving };
}
```

- [ ] **Step 2: Row, section, header, footer**

```tsx
// file: apps/web/src/components/shell/SidebarRow.tsx
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface SidebarRowProps {
  icon: ReactNode;
  label: string;
  to?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  selected?: boolean;
  muted?: boolean;
  className?: string;
  title?: string;
  onHide?: () => void;
}

export function SidebarRow({ icon, label, to, onClick, trailing, selected = false, muted = false, className = '', title, onHide }: SidebarRowProps) {
  let rowClass = `sidebar-link shell-row ${className}`;
  if (selected) {
    rowClass += ' active';
  }
  if (muted) {
    rowClass += ' is-muted';
  }
  let ariaCurrent: 'page' | false = false;
  if (selected) {
    ariaCurrent = 'page';
  }
  const content = (
    <>
      <span className="shell-row-icon" aria-hidden="true">{icon}</span>
      <span className="sidebar-link-label">{label}</span>
      <span className="shell-row-trailing">{trailing}</span>
    </>
  );
  let main = <button type="button" className={rowClass} title={title} onClick={onClick}>{content}</button>;
  if (to) {
    main = <Link className={rowClass} to={to} title={title} aria-current={ariaCurrent} onClick={onClick}>{content}</Link>;
  }
  if (!onHide) {
    return main;
  }
  return (
    <div className="shell-row-wrap">
      {main}
      <button type="button" className="shell-row-hide" aria-label={`Hide ${label} from sidebar`} title="Hide from sidebar" onClick={onHide}><X aria-hidden="true" /></button>
    </div>
  );
}
```

```tsx
// file: apps/web/src/components/shell/SidebarSection.tsx
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { readFlag, writeFlag } from './storage';

export function SidebarSection({ title, storageKey, actions, children }: { title: string; storageKey: string; actions?: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => readFlag(storageKey, false));
  const toggle = () => {
    writeFlag(storageKey, !collapsed);
    setCollapsed(!collapsed);
  };
  let chevronClass = 'shell-section-chevron';
  if (!collapsed) {
    chevronClass += ' is-open';
  }
  return (
    <section className="shell-section" aria-label={title}>
      <div className="sidebar-group-label shell-section-heading">
        <button type="button" className="shell-section-toggle" aria-expanded={!collapsed} onClick={toggle}>
          {title}<ChevronRight className={chevronClass} aria-hidden="true" />
        </button>
        <span className="shell-section-actions">{actions}</span>
      </div>
      {!collapsed && <div className="shell-section-body">{children}</div>}
    </section>
  );
}
```

```tsx
// file: apps/web/src/components/shell/SidebarHeader.tsx
import { PanelLeft, RefreshCw } from 'lucide-react';
import { IconButton } from '../IconButton';

export function SidebarHeader({ collapsed, rescanning, onRescan, onToggle }: { collapsed: boolean; rescanning: boolean; onRescan: () => void; onToggle: () => void }) {
  let rescanClass = '';
  if (rescanning) {
    rescanClass = 'is-spinning';
  }
  let toggleLabel = 'Collapse sidebar';
  if (collapsed) {
    toggleLabel = 'Expand sidebar';
  }
  return (
    <div className="shell-sidebar-header">
      <span className="shell-brand">
        <img src="/brand/skillet.png" width="24" height="24" alt="" />
        <span className="shell-brand-name">Skillet</span>
      </span>
      <span className="shell-header-actions">
        <IconButton label="Rescan" onClick={onRescan} disabled={rescanning}><RefreshCw className={rescanClass} aria-hidden="true" /></IconButton>
        <IconButton label={toggleLabel} onClick={onToggle}><PanelLeft aria-hidden="true" /></IconButton>
      </span>
    </div>
  );
}
```

```tsx
// file: apps/web/src/components/shell/SidebarFooter.tsx
import { Laptop, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Popover } from './Popover';

export function SidebarFooter({ repoCount, scanMs, hubPath, staleCaches, watching }: { repoCount: number; scanMs: number; hubPath: string; staleCaches: number; watching: boolean }) {
  let status = 'Scanning…';
  if (watching) {
    status = 'Watching';
  }
  const seconds = (scanMs / 1000).toFixed(1);
  return (
    <div className="shell-sidebar-footer">
      <Popover placement="above" trigger={({ toggle, open }) => (
        <button type="button" className="shell-footer-status" aria-expanded={open} data-popover-trigger onClick={toggle}>
          <Laptop aria-hidden="true" />
          <span className="shell-footer-copy">
            <span className="shell-footer-line"><strong>This Mac</strong>{watching && <span className="shell-dot" aria-hidden="true" />}<span>{status}</span></span>
            <span className="shell-footer-meta">{`${repoCount} repos · scanned in ${seconds} s`}</span>
          </span>
        </button>
      )}>
        {() => (
          <div className="shell-footer-popover">
            <span className="shell-menu-meta">Hub</span>
            <code>{hubPath}</code>
            <span className="shell-menu-meta">{`${staleCaches} stale plugin caches`}</span>
          </div>
        )}
      </Popover>
      <Link className="icon-button shell-footer-settings" to="/settings" aria-label="Settings" title="Settings"><Settings2 aria-hidden="true" /></Link>
    </div>
  );
}
```

- [ ] **Step 3: Agents, projects, picker**

```tsx
// file: apps/web/src/components/shell/SidebarAgents.tsx
import { Plus } from 'lucide-react';
import type { Agent } from '../../api/client.types';
import { AgentIcon } from '../AgentIcon';
import { IconButton } from '../IconButton';
import { SidebarRow } from './SidebarRow';
import { SidebarSection } from './SidebarSection';
import { withoutId, idsOf } from './sidebar-state';

export function SidebarAgents({ agents, activeAgent, onHide, onEdit, onNavigate }: { agents: Agent[]; activeAgent: string; onHide: (ids: string[]) => void; onEdit: () => void; onNavigate: () => void }) {
  const shownIds = idsOf(agents);
  return (
    <SidebarSection title="Agents" storageKey="skillet.sidebar.agents.collapsed" actions={<IconButton label="Choose agents" onClick={onEdit}><Plus aria-hidden="true" /></IconButton>}>
      {agents.map((agent) => {
        let dot = null;
        if (agent.installed) {
          dot = <span className="shell-dot" aria-label="Detected" />;
        }
        return (
          <SidebarRow key={agent.id} className="agent-filter" icon={<AgentIcon id={agent.id} name={agent.name} decorative />} label={agent.name} to={`/skills?agent=${encodeURIComponent(agent.id)}`} selected={activeAgent === agent.id} trailing={dot} title={agent.name} onClick={onNavigate} onHide={() => onHide(withoutId(shownIds, agent.id))} />
        );
      })}
      {agents.length === 0 && <SidebarRow icon={<Plus />} label="Choose agents" muted onClick={onEdit} />}
    </SidebarSection>
  );
}
```

```tsx
// file: apps/web/src/components/shell/SidebarProjects.tsx
import { Folder, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Repo } from '../../api/client.types';
import { IconButton } from '../IconButton';
import { SidebarRow } from './SidebarRow';
import { SidebarSection } from './SidebarSection';
import { DEFAULT_VISIBLE_PROJECTS, idsOf, withoutId } from './sidebar-state';

export function SidebarProjects({ repos, counts, hiddenCount, activeRepo, onHide, onEdit, onNavigate }: { repos: Repo[]; counts: Map<string, number>; hiddenCount: number; activeRepo: string; onHide: (ids: string[]) => void; onEdit: () => void; onNavigate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const shownIds = idsOf(repos);
  const visible: Repo[] = [];
  for (const repo of repos) {
    if (expanded || visible.length < DEFAULT_VISIBLE_PROJECTS) {
      visible.push(repo);
    }
  }
  const overflow = repos.length - visible.length;
  let moreLabel = '';
  if (overflow > 0) {
    moreLabel = `${overflow} more · Show all`;
  } else if (hiddenCount > 0) {
    moreLabel = `${hiddenCount} hidden · Show all`;
  }
  const showMore = () => {
    if (overflow > 0) {
      setExpanded(true);
      return;
    }
    onEdit();
  };
  return (
    <SidebarSection title="Projects" storageKey="skillet.sidebar.projects.collapsed" actions={<IconButton label="Choose projects" onClick={onEdit}><Plus aria-hidden="true" /></IconButton>}>
      {visible.map((repo) => (
        <SidebarRow key={repo.id} icon={<Folder />} label={repo.label} title={repo.gitRoot} to={`/skills?repo=${encodeURIComponent(repo.id)}`} selected={activeRepo === repo.id} trailing={String(counts.get(repo.id) ?? 0)} onClick={onNavigate} onHide={() => onHide(withoutId(shownIds, repo.id))} />
      ))}
      {repos.length === 0 && <SidebarRow icon={<Plus />} label="Choose projects" muted onClick={onEdit} />}
      {moreLabel.length > 0 && <button type="button" className="shell-row-more" onClick={showMore}>{moreLabel}</button>}
    </SidebarSection>
  );
}
```

```tsx
// file: apps/web/src/components/shell/SidebarPickerDialog.tsx
import { Folder, Search } from 'lucide-react';
import { useState } from 'react';
import type { Agent, Repo } from '../../api/client.types';
import { AgentIcon } from '../AgentIcon';
import { Dialog } from '../Dialog';
import { SegmentedTabs } from './SegmentedTabs';
import { Switch } from './Switch';

export type PickerTab = 'agents' | 'projects';

export interface PickerResult {
  sidebarAgents: string[] | null;
  sidebarRepos: string[] | null;
}

interface PickerItem {
  id: string;
  label: string;
  detail: string;
  icon: 'agent' | 'folder';
}

function matches(item: PickerItem, query: string): boolean {
  if (query.length === 0) {
    return true;
  }
  return item.label.toLowerCase().includes(query) || item.detail.toLowerCase().includes(query);
}

export function SidebarPickerDialog({ initialTab, agents, repos, counts, shownAgentIds, shownRepoIds, saving, onSave, onClose }: {
  initialTab: PickerTab; agents: Agent[]; repos: Repo[]; counts: Map<string, number>; shownAgentIds: string[]; shownRepoIds: string[]; saving: boolean; onSave: (result: PickerResult) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<PickerTab>(initialTab);
  const [agentDraft, setAgentDraft] = useState(new Set(shownAgentIds));
  const [repoDraft, setRepoDraft] = useState(new Set(shownRepoIds));
  const [query, setQuery] = useState('');

  const items: PickerItem[] = [];
  if (tab === 'agents') {
    for (const agent of agents) {
      let detail = 'Not detected';
      if (agent.installed) {
        detail = 'Detected';
      }
      items.push({ id: agent.id, label: agent.name, detail, icon: 'agent' });
    }
  } else {
    for (const repo of repos) {
      if (repo.isWorktree) {
        continue;
      }
      const count = counts.get(repo.id) ?? 0;
      let detail = `${count} skills · ${repo.branch}`;
      if (count === 1) {
        detail = `1 skill · ${repo.branch}`;
      }
      items.push({ id: repo.id, label: repo.label, detail, icon: 'folder' });
    }
  }
  let draft = repoDraft;
  if (tab === 'agents') {
    draft = agentDraft;
  }
  const needle = query.trim().toLowerCase();
  const shown: PickerItem[] = [];
  const hidden: PickerItem[] = [];
  for (const item of items) {
    if (!matches(item, needle)) {
      continue;
    }
    if (draft.has(item.id)) {
      shown.push(item);
    } else {
      hidden.push(item);
    }
  }

  const setChecked = (id: string, checked: boolean) => {
    const next = new Set(draft);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    if (tab === 'agents') {
      setAgentDraft(next);
      return;
    }
    setRepoDraft(next);
  };

  const withSkillsOnly = () => {
    const next = new Set<string>();
    for (const repo of repos) {
      if (!repo.isWorktree && (counts.get(repo.id) ?? 0) > 0) {
        next.add(repo.id);
      }
    }
    setRepoDraft(next);
  };

  const hideAll = () => {
    if (tab === 'agents') {
      setAgentDraft(new Set());
      return;
    }
    setRepoDraft(new Set());
  };

  const renderRow = (item: PickerItem) => {
    let icon = <Folder aria-hidden="true" />;
    if (item.icon === 'agent') {
      icon = <AgentIcon id={item.id} name={item.label} decorative />;
    }
    return (
      <div className="shell-picker-row" key={item.id}>
        <span className="shell-row-icon">{icon}</span>
        <span className="shell-picker-copy"><span>{item.label}</span><span className="shell-picker-detail">{item.detail}</span></span>
        <Switch checked={draft.has(item.id)} label={`Show ${item.label} in sidebar`} disabled={saving} onChange={(checked) => setChecked(item.id, checked)} />
      </div>
    );
  };

  let total = repos.length;
  let placeholder = 'Search projects';
  if (tab === 'agents') {
    total = agents.length;
    placeholder = 'Search agents';
  }

  const footer = (
    <div className="dialog-actions shell-picker-actions">
      <button type="button" className="button-link" disabled={saving} onClick={() => onSave({ sidebarAgents: null, sidebarRepos: null })}>Reset to default</button>
      <button type="button" disabled={saving} onClick={onClose}>Cancel</button>
      <button type="button" className="primary" disabled={saving} onClick={() => onSave({ sidebarAgents: [...agentDraft], sidebarRepos: [...repoDraft] })}>Save</button>
    </div>
  );

  return (
    <Dialog title="Edit sidebar" description="Choose what shows on the left. Hidden items stay searchable." busy={saving} onClose={onClose} footer={footer}>
      <div className="shell-picker-toolbar">
        <SegmentedTabs<PickerTab> label="Sidebar section" value={tab} onChange={setTab} options={[{ value: 'agents', label: `Agents ${agentDraft.size}` }, { value: 'projects', label: `Projects ${repoDraft.size}` }]} />
        <span className="shell-picker-shortcuts">
          {tab === 'projects' && <button type="button" className="button-link" onClick={withSkillsOnly}>With skills only</button>}
          <button type="button" className="button-link" onClick={hideAll}>Hide all</button>
        </span>
      </div>
      <label className="shell-picker-search"><Search aria-hidden="true" /><input type="search" placeholder={`${placeholder} (${total})`} aria-label={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="shell-picker-list">
        {shown.length > 0 && <span className="shell-picker-group">Shown in sidebar</span>}
        {shown.map(renderRow)}
        {hidden.length > 0 && <span className="shell-picker-group">Hidden</span>}
        {hidden.map(renderRow)}
        {shown.length === 0 && hidden.length === 0 && <p className="shell-picker-empty">{`Nothing matches “${query}”.`}</p>}
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4a: Shared event name**

```ts
// file: apps/web/src/components/command-bar/command-bar.constants.ts
export const FOCUS_COMMAND_BAR_EVENT = 'skillet:focus-command-bar';
```

- [ ] **Step 4: Sidebar composition**

```tsx
// file: apps/web/src/components/Sidebar.tsx
import { Bot, Boxes, ChevronDown, Compass, Menu, PackageCheck, Search, Settings2, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { KeyHint } from './shell/KeyHint';
import { Popover, PopoverDivider, PopoverItem } from './shell/Popover';
import { SidebarAgents } from './shell/SidebarAgents';
import { SidebarFooter } from './shell/SidebarFooter';
import { SidebarHeader } from './shell/SidebarHeader';
import { SidebarPickerDialog } from './shell/SidebarPickerDialog';
import type { PickerResult, PickerTab } from './shell/SidebarPickerDialog';
import { SidebarProjects } from './shell/SidebarProjects';
import { SidebarRow } from './shell/SidebarRow';
import { defaultAgents, defaultRepos, idsOf, pickById, skillCountByRepo } from './shell/sidebar-state';
import { readFlag, writeFlag } from './shell/storage';
import { useSidebarConfig } from './shell/useSidebarConfig';
import { useToast } from './Toaster';
import { FOCUS_COMMAND_BAR_EVENT } from './command-bar/command-bar.constants';

export function Sidebar() {
  const { index, refresh } = useIndex();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const sidebar = useSidebarConfig();
  const [collapsed, setCollapsed] = useState(() => readFlag('skillet.sidebar.collapsed', false));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [picker, setPicker] = useState<PickerTab | ''>('');
  const [rescanning, setRescanning] = useState(false);

  if (!index) {
    return <aside className="sidebar" aria-label="Primary navigation" />;
  }

  const onSkills = location.pathname === '/skills';
  let activeAgent = '';
  let activeRepo = '';
  if (onSkills) {
    activeAgent = params.get('agent') ?? '';
    activeRepo = params.get('repo') ?? '';
  }
  const allSkillsActive = onSkills && activeAgent.length === 0 && activeRepo.length === 0 && !params.get('scope');

  let agents = defaultAgents(index.agents);
  if (sidebar.agentIds !== null) {
    agents = pickById(index.agents, sidebar.agentIds);
  }
  const counts = skillCountByRepo(index.skills);
  let repos = defaultRepos(index.repos, counts);
  if (sidebar.repoIds !== null) {
    repos = pickById(index.repos, sidebar.repoIds);
  }
  let mainCheckouts = 0;
  for (const repo of index.repos) {
    if (!repo.isWorktree) {
      mainCheckouts += 1;
    }
  }

  const toggleCollapsed = () => {
    writeFlag('skillet.sidebar.collapsed', !collapsed);
    setCollapsed(!collapsed);
  };
  const closeMobile = () => setMobileOpen(false);
  const rescan = () => {
    setRescanning(true);
    api
      .rescan()
      .then(() => refresh())
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'rescan failed'), 'error'))
      .finally(() => setRescanning(false));
  };
  const savePicker = (result: PickerResult) => {
    void sidebar.save(result).then(() => setPicker(''));
  };

  let asideClass = 'sidebar shell-sidebar';
  if (collapsed) {
    asideClass += ' is-collapsed';
  }
  let MobileIcon = Menu;
  if (mobileOpen) {
    MobileIcon = X;
  }

  return (
    <aside className={asideClass} aria-label="Primary navigation">
      <SidebarHeader collapsed={collapsed} rescanning={rescanning} onRescan={rescan} onToggle={toggleCollapsed} />
      <button className="icon-button mobile-nav-toggle" aria-label="Toggle navigation" aria-expanded={mobileOpen} aria-controls="skillet-navigation" onClick={() => setMobileOpen(!mobileOpen)}><MobileIcon aria-hidden="true" /></button>
      <nav id="skillet-navigation" className="sidebar-navigation" data-open={mobileOpen} aria-label="Workspace">
        <button type="button" className="shell-search-trigger" onClick={() => window.dispatchEvent(new Event(FOCUS_COMMAND_BAR_EVENT))}>
          <Search aria-hidden="true" /><span className="sidebar-link-label">Search skills</span><KeyHint>⌘K</KeyHint>
        </button>
        <SidebarRow icon={<Boxes />} label="All skills" to="/skills" selected={allSkillsActive} trailing={String(index.skills.length)} onClick={closeMobile} />
        <SidebarRow icon={<Compass />} label="Find skills" to="/discover" selected={location.pathname === '/discover'} onClick={closeMobile} />
        <SidebarRow icon={<PackageCheck />} label="Adopt into hub" to="/adopt" selected={location.pathname === '/adopt'} onClick={closeMobile} />
        <Popover placement="right" trigger={({ toggle, open }) => (
          <button type="button" className="sidebar-link shell-row is-muted" aria-expanded={open} data-popover-trigger onClick={toggle}>
            <span className="shell-row-icon" aria-hidden="true"><ChevronDown /></span><span className="sidebar-link-label">More</span><span className="shell-row-trailing" />
          </button>
        )}>
          {(close) => (
            <>
              <PopoverItem icon={<Bot />} label="All agents" meta={String(index.agents.length)} onSelect={() => { close(); navigate('/agents'); }} />
              <PopoverItem icon={<Trash2 />} label="Trash" onSelect={() => { close(); navigate('/trash'); }} />
              <PopoverItem icon={<Settings2 />} label="Settings" onSelect={() => { close(); navigate('/settings'); }} />
              <PopoverDivider />
              <PopoverItem label="Edit sidebar…" onSelect={() => { close(); setPicker('agents'); }} />
            </>
          )}
        </Popover>
        <SidebarAgents agents={agents} activeAgent={activeAgent} onNavigate={closeMobile} onEdit={() => setPicker('agents')} onHide={(ids) => void sidebar.save({ sidebarAgents: ids })} />
        <SidebarProjects repos={repos} counts={counts} hiddenCount={Math.max(0, mainCheckouts - repos.length)} activeRepo={activeRepo} onNavigate={closeMobile} onEdit={() => setPicker('projects')} onHide={(ids) => void sidebar.save({ sidebarRepos: ids })} />
      </nav>
      <SidebarFooter repoCount={index.repos.length} scanMs={index.scanMs} hubPath={index.hubPath} staleCaches={index.stalePluginVersions} watching={!rescanning} />
      {picker !== '' && (
        <SidebarPickerDialog initialTab={picker} agents={index.agents} repos={index.repos} counts={counts} shownAgentIds={idsOf(agents)} shownRepoIds={idsOf(repos)} saving={sidebar.saving} onSave={savePicker} onClose={() => setPicker('')} />
      )}
    </aside>
  );
}
```

- [ ] **Step 5: Styles** — append to `shell.css`:

```css
/* Sidebar — Paper: Shell · Sidebar / * */
.shell-sidebar { display: flex; flex-direction: column; width: 272px; padding: 14px 10px 0; background: var(--shell-sidebar); border-right: 1px solid var(--shell-hairline); }
.shell-sidebar .sidebar-navigation { display: flex; flex: 1; flex-direction: column; gap: 1px; min-height: 0; overflow-y: auto; }
.shell-sidebar-header { display: flex; align-items: center; justify-content: space-between; height: 36px; padding: 0 2px 0 8px; margin-bottom: 10px; }
.shell-brand { display: inline-flex; align-items: center; gap: 8px; }
.shell-brand img { width: 24px; height: 24px; object-fit: contain; }
.shell-brand-name { color: var(--shell-ink); font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.shell-header-actions { display: inline-flex; gap: 2px; }
.shell-header-actions .icon-button, .shell-section-actions .icon-button, .shell-footer-settings { width: 28px; height: 28px; min-height: 28px; padding: 0; }
.shell-header-actions svg, .shell-footer-settings svg { width: 16px; height: 16px; }
.shell-search-trigger { display: flex; align-items: center; gap: 10px; height: 34px; min-height: 34px; margin-bottom: 6px; padding: 0 8px 0 10px; border: 1px solid var(--shell-hairline); border-radius: 8px; background: var(--shell-surface); color: var(--shell-muted); font-size: 14px; text-align: left; }
.shell-search-trigger svg { width: 16px; height: 16px; flex-shrink: 0; }
.shell-row { display: flex; align-items: center; gap: 10px; width: 100%; height: var(--shell-row); min-height: var(--shell-row); padding: 0 8px 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--shell-ink-2); font-size: 14px; text-align: left; }
.shell-row:hover { background: var(--shell-hover); color: var(--shell-ink); border: 0; }
.shell-row.active { background: var(--shell-selected); color: var(--shell-ink); font-weight: 500; }
.shell-row.active svg { color: var(--shell-ink); }
.shell-row.is-muted { color: var(--shell-muted); }
.shell-row-icon { display: inline-flex; width: 16px; flex-shrink: 0; align-items: center; justify-content: center; }
.shell-row-icon svg, .shell-row-icon .agent-icon, .shell-row-icon .agent-icon-art { width: 16px; height: 16px; }
.shell-row-trailing { display: inline-flex; width: 24px; flex-shrink: 0; justify-content: flex-end; color: var(--shell-muted); font-size: 12px; font-weight: 400; }
.shell-row-wrap { position: relative; }
.shell-row-hide { position: absolute; top: 50%; right: 6px; display: none; width: 22px; height: 22px; min-height: 0; padding: 0; border: 0; border-radius: 6px; background: var(--shell-hover); color: var(--shell-ink-2); transform: translateY(-50%); align-items: center; justify-content: center; }
.shell-row-hide svg { width: 14px; height: 14px; }
.shell-row-wrap:hover .shell-row-hide, .shell-row-hide:focus-visible { display: inline-flex; }
.shell-row-wrap:hover .shell-row-trailing { visibility: hidden; }
.shell-row-more { height: 30px; min-height: 30px; padding: 0 10px 0 36px; border: 0; background: transparent; color: var(--shell-muted); font-size: 13px; text-align: left; }
.shell-dot { display: inline-block; width: 6px; height: 6px; border-radius: 3px; background: var(--shell-detected); }
.shell-section { margin-top: 18px; }
.shell-section-heading { display: flex; align-items: center; justify-content: space-between; height: 28px; padding: 0 4px 0 10px; }
.shell-section-toggle { display: inline-flex; align-items: center; gap: 4px; min-height: 0; padding: 0; border: 0; background: transparent; color: var(--shell-muted); font-size: 12px; font-weight: 500; }
.shell-section-toggle:hover { border: 0; background: transparent; color: var(--shell-ink); }
.shell-section-chevron { width: 12px; height: 12px; transition: transform var(--ui-duration-fast); }
.shell-section-chevron.is-open { transform: rotate(90deg); }
.shell-section-actions { display: inline-flex; opacity: 0; transition: opacity var(--ui-duration-fast); }
.shell-section:hover .shell-section-actions, .shell-section-actions:focus-within { opacity: 1; }
.shell-section-actions svg { width: 14px; height: 14px; }
.shell-section-body { display: flex; flex-direction: column; gap: 1px; }
.shell-sidebar-footer { display: flex; align-items: center; gap: 4px; height: 52px; margin: 8px -10px 0; padding: 0 8px 0 10px; border-top: 1px solid var(--shell-hairline); }
.shell-sidebar-footer .shell-popover-anchor { flex: 1; min-width: 0; }
.shell-footer-status { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 4px 6px; border: 0; border-radius: 8px; background: transparent; text-align: left; }
.shell-footer-status:hover { border: 0; background: var(--shell-hover); }
.shell-footer-status > svg { width: 16px; height: 16px; flex-shrink: 0; color: var(--shell-ink-2); }
.shell-footer-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.shell-footer-line { display: flex; align-items: center; gap: 6px; color: var(--shell-muted); font-size: 12px; }
.shell-footer-line strong { color: var(--shell-ink); font-size: 13px; font-weight: 500; }
.shell-footer-meta { color: var(--shell-muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shell-footer-popover { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; max-width: 320px; }
.shell-footer-popover code { font-size: 12px; overflow-wrap: anywhere; }
.shell-sidebar.is-collapsed { width: 60px; padding: 12px 8px 0; }
.shell-sidebar.is-collapsed .sidebar-link-label, .shell-sidebar.is-collapsed .shell-row-trailing, .shell-sidebar.is-collapsed .shell-brand-name, .shell-sidebar.is-collapsed .shell-section-heading, .shell-sidebar.is-collapsed .shell-kbd, .shell-sidebar.is-collapsed .shell-footer-copy, .shell-sidebar.is-collapsed .shell-footer-settings, .shell-sidebar.is-collapsed .shell-row-more, .shell-sidebar.is-collapsed .shell-header-actions .icon-control:first-child { display: none; }
.shell-sidebar.is-collapsed .shell-sidebar-header { flex-direction: column; gap: 8px; height: auto; padding: 0; }
.shell-sidebar.is-collapsed .shell-row, .shell-sidebar.is-collapsed .shell-search-trigger { justify-content: center; width: 36px; height: 36px; padding: 0; margin-left: auto; margin-right: auto; }
.shell-sidebar.is-collapsed .shell-section { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--shell-hairline); }
.shell-sidebar.is-collapsed .shell-sidebar-footer { justify-content: center; margin: 8px -8px 0; padding: 0; }
.shell-picker-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.shell-picker-shortcuts { display: inline-flex; gap: 14px; }
.shell-picker-shortcuts .button-link, .shell-picker-actions .button-link { min-height: 32px; padding: 0; border: 0; background: none; color: var(--shell-ink-2); }
.shell-picker-search { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border: 1px solid var(--shell-control); border-radius: 9px; }
.shell-picker-search svg { width: 15px; height: 15px; color: var(--shell-muted); }
.shell-picker-search input { flex: 1; min-height: 0; padding: 0; border: 0; background: transparent; font-size: 14px; }
.shell-picker-search input:focus { outline: none; }
.shell-picker-list { display: flex; flex-direction: column; gap: 1px; max-height: min(52vh, 440px); margin-top: 10px; overflow-y: auto; }
.shell-picker-group { padding: 12px 10px 6px; color: var(--shell-muted); font-size: 12px; font-weight: 500; }
.shell-picker-row { display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0 10px; border-radius: 8px; }
.shell-picker-row:hover { background: var(--shell-hover); }
.shell-picker-copy { display: flex; flex: 1; flex-direction: column; min-width: 0; color: var(--shell-ink); font-size: 14px; }
.shell-picker-detail { color: var(--shell-muted); font-size: 12px; }
.shell-picker-empty { padding: 12px 10px; color: var(--shell-muted); font-size: 13px; }
.shell-picker-actions { display: flex; align-items: center; gap: 10px; margin-top: 0; padding-top: 0; border-top: 0; }
.shell-picker-actions .button-link { margin-right: auto; }
```

- [ ] **Step 6: Cleanup and verify** — delete `SidebarAgentFilters.tsx`; in `agent-icons.css` delete every rule from `.sidebar-agent-row` / `.sidebar-group-heading` to the end that the earlier sidebar work appended. Run `bun run typecheck && bun run lint && bun run deadcode` → exit 0 except Task 5–7 exports. Screenshot http://127.0.0.1:5180/skills expanded and after clicking the collapse button (collapse is per viewer, no config write).

---

### Task 5: Command bar (Paper: Shell · Command / *)

**Files:**
- Create: `apps/web/src/components/command-bar/commands.ts`, `CommandBar.tsx`, `CommandMenu.tsx`, `FilterChips.tsx`, `command-bar.types.ts`, `command-bar.constants.ts` (created in Task 4, holds `FOCUS_COMMAND_BAR_EVENT`)
- Modify: `apps/web/src/app/App.tsx` (mount `CommandBar` inside `app-main`, remove `CommandPalette`)
- Delete: `apps/web/src/components/CommandPalette.tsx`
- Modify: `apps/web/src/styles/shell.css`

**Interfaces:**
- Consumes: `FOCUS_COMMAND_BAR_EVENT` from `command-bar.constants.ts` (Task 4), `KeyHint`, `FilterChip`, `AddFilterChip`, `Popover`, `PopoverItem` (Task 3), `PlanDialog`, `api.*`.
- Produces: `CommandBar()`; URL param `q` as the Skills page search (Task 6 reads it).

- [ ] **Step 1: Types and commands**

```ts
// file: apps/web/src/components/command-bar/command-bar.types.ts
import type { OpResult, SkilletIndex } from '../../api/client.types';

export type StepKind = 'skill' | 'agent' | 'destination' | 'text';

export interface CommandStep {
  kind: StepKind;
  prompt: string;
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

export interface MenuOption {
  id: string;
  label: string;
  meta: string;
}
```

```ts
// file: apps/web/src/components/command-bar/commands.ts
import { api } from '../../api/client';
import type { LinkTarget, SkilletIndex } from '../../api/client.types';
import type { CommandDefinition, MenuOption, PickedValue, StepKind } from './command-bar.types';

export const GLOBAL_DESTINATION = '';

function targetFor(index: SkilletIndex, skillId: string, agentId: string, destination: string): LinkTarget {
  if (destination.length > 0) {
    return { agentId, scope: 'project', repoId: destination };
  }
  for (const skill of index.skills) {
    if (skill.id === skillId && skill.scope === 'project') {
      return { agentId, scope: 'project', repoId: skill.repoId };
    }
  }
  return { agentId, scope: 'global', repoId: '' };
}

export function buildCommands(index: SkilletIndex): CommandDefinition[] {
  return [
    {
      id: 'link', summary: 'make a skill visible to an agent',
      steps: [{ kind: 'skill', prompt: 'Search skills' }, { kind: 'agent', prompt: 'Search agents' }],
      mutate: (values, dryRun) => api.link(values[0].id, { target: targetFor(index, values[0].id, values[1].id, GLOBAL_DESTINATION), dryRun })
    },
    {
      id: 'copy', summary: 'copy a skill to an agent or project',
      steps: [{ kind: 'skill', prompt: 'Search skills' }, { kind: 'agent', prompt: 'Search agents' }, { kind: 'destination', prompt: 'Global or a project' }],
      mutate: (values, dryRun) => api.copy(values[0].id, { target: targetFor(index, values[0].id, values[1].id, values[2].id), mode: 'copy', dryRun })
    },
    {
      id: 'move', summary: 'move a skill to an agent or project',
      steps: [{ kind: 'skill', prompt: 'Search skills' }, { kind: 'agent', prompt: 'Search agents' }, { kind: 'destination', prompt: 'Global or a project' }],
      mutate: (values, dryRun) => api.move(values[0].id, { target: targetFor(index, values[0].id, values[1].id, values[2].id), keepLinkAtSource: false, dryRun })
    },
    {
      id: 'rename', summary: 'rename a skill',
      steps: [{ kind: 'skill', prompt: 'Search skills' }, { kind: 'text', prompt: 'New name, lowercase-with-hyphens' }],
      mutate: (values, dryRun) => api.rename(values[0].id, { newName: values[1].id, dryRun })
    },
    {
      id: 'trash', summary: 'move a skill to the trash',
      steps: [{ kind: 'skill', prompt: 'Search skills' }],
      mutate: (values, dryRun) => api.trash(values[0].id, { dryRun })
    },
    {
      id: 'undo', summary: 'undo the last change', steps: [],
      act: async (_values, context) => {
        try {
          const result = await api.undo();
          context.refresh();
          return `Undid ${result.entry.id}`;
        } catch (error) {
          throw new Error(`undo failed: ${String(error)}`);
        }
      }
    },
    { id: 'agent', summary: 'show skills an agent can read', steps: [{ kind: 'agent', prompt: 'Search agents' }], act: (values, context) => { context.navigate(`/skills?agent=${encodeURIComponent(values[0].id)}`); return Promise.resolve(''); } },
    { id: 'repo', summary: 'show skills in a project', steps: [{ kind: 'destination', prompt: 'Search projects' }], act: (values, context) => { context.navigate(`/skills?repo=${encodeURIComponent(values[0].id)}`); return Promise.resolve(''); } },
    {
      id: 'rescan', summary: 'scan the machine again', steps: [],
      act: async (_values, context) => {
        try {
          await api.rescan();
          context.refresh();
          return 'Rescanned';
        } catch (error) {
          throw new Error(`rescan failed: ${String(error)}`);
        }
      }
    },
    { id: 'adopt', summary: 'open Adopt into hub', steps: [], act: (_values, context) => { context.navigate('/adopt'); return Promise.resolve(''); } },
    { id: 'agents', summary: 'open All agents', steps: [], act: (_values, context) => { context.navigate('/agents'); return Promise.resolve(''); } },
    { id: 'trash-bin', summary: 'open Trash', steps: [], act: (_values, context) => { context.navigate('/trash'); return Promise.resolve(''); } },
    { id: 'settings', summary: 'open Settings', steps: [], act: (_values, context) => { context.navigate('/settings'); return Promise.resolve(''); } }
  ];
}

function includesNeedle(text: string, needle: string): boolean {
  return needle.length === 0 || text.toLowerCase().includes(needle);
}

export function optionsFor(kind: StepKind, index: SkilletIndex, needle: string, picked: PickedValue[]): MenuOption[] {
  const options: MenuOption[] = [];
  if (kind === 'skill') {
    for (const skill of index.skills) {
      if (includesNeedle(`${skill.name} ${skill.description}`, needle)) {
        options.push({ id: skill.id, label: skill.name, meta: skill.scope });
      }
    }
  }
  if (kind === 'agent') {
    let linked = new Set<string>();
    if (picked.length > 0) {
      linked = linkedAgents(index, picked[0].id);
    }
    for (const agent of index.agents) {
      if (!includesNeedle(agent.name, needle)) {
        continue;
      }
      let meta = 'Not detected';
      if (agent.installed) {
        meta = 'Detected';
      }
      if (linked.has(agent.id)) {
        meta = 'Already linked';
      }
      options.push({ id: agent.id, label: agent.name, meta });
    }
  }
  if (kind === 'destination') {
    if (includesNeedle('global', needle)) {
      options.push({ id: GLOBAL_DESTINATION, label: 'Global', meta: 'Every project' });
    }
    for (const repo of index.repos) {
      if (!repo.isWorktree && includesNeedle(repo.label, needle)) {
        options.push({ id: repo.id, label: repo.label, meta: repo.branch });
      }
    }
  }
  return options.slice(0, 8);
}

function linkedAgents(index: SkilletIndex, skillId: string): Set<string> {
  const linked = new Set<string>();
  const cells = index.cells[skillId] ?? [];
  for (const cell of cells) {
    if (cell.state !== 'not-linked' && cell.state !== 'n-a' && cell.state !== 'off') {
      linked.add(cell.agentId);
    }
  }
  return linked;
}
```

- [ ] **Step 2: Menu and chips**

```tsx
// file: apps/web/src/components/command-bar/CommandMenu.tsx
import type { MenuOption } from './command-bar.types';

export function CommandMenu({ title, meta, options, activeIndex, onPick, footer }: { title: string; meta: string; options: MenuOption[]; activeIndex: number; onPick: (option: MenuOption) => void; footer: string }) {
  return (
    <div className="shell-command-menu" role="listbox" aria-label={title}>
      <div className="shell-command-menu-head"><span>{title}</span><span>{meta}</span></div>
      {options.map((option, position) => {
        let className = 'shell-menu-item';
        if (position === activeIndex) {
          className += ' is-active';
        }
        return (
          <button type="button" role="option" aria-selected={position === activeIndex} key={`${option.id}-${position}`} className={className} onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(option)}>
            <span className="shell-menu-label">{option.label}</span>
            <span className="shell-menu-meta">{option.meta}</span>
          </button>
        );
      })}
      {options.length === 0 && <p className="shell-command-empty">No matches.</p>}
      <div className="shell-command-menu-foot">{footer}</div>
    </div>
  );
}
```

```tsx
// file: apps/web/src/components/command-bar/FilterChips.tsx
import { useSearchParams } from 'react-router-dom';
import type { SkilletIndex } from '../../api/client.types';
import { AddFilterChip, FilterChip } from '../shell/FilterChip';
import { Popover, PopoverItem } from '../shell/Popover';

const SCOPE_LABELS: Record<string, string> = { global: 'Global', project: 'Project', plugin: 'Plugin' };

export function FilterChips({ index }: { index: SkilletIndex }) {
  const [params, setParams] = useSearchParams();
  const remove = (key: string) => {
    const next = new URLSearchParams(params);
    next.delete(key);
    setParams(next);
  };
  const add = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  };
  const chips: { key: string; label: string }[] = [];
  const scope = params.get('scope') ?? '';
  if (scope.length > 0) {
    chips.push({ key: 'scope', label: SCOPE_LABELS[scope] ?? scope });
  }
  const agentId = params.get('agent') ?? '';
  for (const agent of index.agents) {
    if (agent.id === agentId) {
      chips.push({ key: 'agent', label: `Visible to ${agent.name}` });
    }
  }
  const repoId = params.get('repo') ?? '';
  for (const repo of index.repos) {
    if (repo.id === repoId) {
      chips.push({ key: 'repo', label: repo.label });
    }
  }
  if (params.get('hub') === '1') {
    chips.push({ key: 'hub', label: 'Shared hub' });
  }
  return (
    <div className="shell-chips">
      {chips.map((chip) => <FilterChip key={chip.key} label={chip.label} onRemove={() => remove(chip.key)} />)}
      <Popover placement="above" trigger={({ toggle }) => <AddFilterChip onClick={toggle} />}>
        {(close) => (
          <>
            <PopoverItem label="Global skills" onSelect={() => { close(); add('scope', 'global'); }} />
            <PopoverItem label="Project skills" onSelect={() => { close(); add('scope', 'project'); }} />
            <PopoverItem label="Plugin skills" onSelect={() => { close(); add('scope', 'plugin'); }} />
            <PopoverItem label="In the shared hub" onSelect={() => { close(); add('hub', '1'); }} />
          </>
        )}
      </Popover>
    </div>
  );
}
```

- [ ] **Step 3: Command bar**

```tsx
// file: apps/web/src/components/command-bar/CommandBar.tsx
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import type { FsStep } from '../../api/client.types';
import { useIndex } from '../../app/IndexProvider';
import { PlanDialog } from '../PlanDialog';
import { FOCUS_COMMAND_BAR_EVENT } from './command-bar.constants';
import { KeyHint } from '../shell/KeyHint';
import { useToast } from '../Toaster';
import type { CommandContext, CommandDefinition, MenuOption, PickedValue } from './command-bar.types';
import { buildCommands, optionsFor } from './commands';
import { CommandMenu } from './CommandMenu';
import { FilterChips } from './FilterChips';

interface PendingPlan {
  title: string;
  steps: FsStep[];
  command: CommandDefinition;
  values: PickedValue[];
}

export function CommandBar() {
  const { index, refresh } = useIndex();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [command, setCommand] = useState<CommandDefinition | null>(null);
  const [values, setValues] = useState<PickedValue[]>([]);
  const [active, setActive] = useState(0);
  const [plan, setPlan] = useState<PendingPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const onSkills = location.pathname === '/skills';

  useEffect(() => {
    const focusBar = () => inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (document.querySelector('dialog[open]')) {
          return;
        }
        event.preventDefault();
        focusBar();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(FOCUS_COMMAND_BAR_EVENT, focusBar);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(FOCUS_COMMAND_BAR_EVENT, focusBar);
    };
  }, []);

  const commands = useMemo(() => {
    if (!index) {
      return [];
    }
    return buildCommands(index);
  }, [index]);

  if (!index) {
    return null;
  }

  const context: CommandContext = {
    index,
    navigate,
    refresh,
    setParam: (key, value) => {
      const next = new URLSearchParams(params);
      next.set(key, value);
      setParams(next);
    }
  };

  const reset = () => {
    setCommand(null);
    setValues([]);
    setText('');
    setActive(0);
  };

  const setSearch = (value: string) => {
    setText(value);
    setActive(0);
    if (command || value.startsWith('/') || !onSkills) {
      return;
    }
    const next = new URLSearchParams(params);
    if (value.trim().length > 0) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    setParams(next, { replace: true });
  };

  const step = command?.steps[values.length];
  const needle = text.trim().toLowerCase();
  let menuTitle = '';
  let menuMeta = '';
  let menuFooter = '↑↓ to move · ↵ to choose · esc to go back';
  const options: MenuOption[] = [];
  if (command && step && step.kind !== 'text') {
    menuTitle = step.prompt;
    for (const option of optionsFor(step.kind, index, needle, values)) {
      options.push(option);
    }
    if (values.length + 1 === command.steps.length && command.mutate) {
      menuFooter = '↵ to preview · nothing is written until you apply';
    }
  } else if (!command && text.startsWith('/')) {
    menuTitle = 'Commands';
    const commandNeedle = text.slice(1).toLowerCase();
    for (const definition of commands) {
      if (definition.id.startsWith(commandNeedle) || definition.summary.includes(commandNeedle)) {
        options.push({ id: definition.id, label: `/${definition.id}`, meta: definition.summary });
      }
    }
  } else if (!command && !onSkills && needle.length > 0 && focused) {
    menuTitle = 'Skills';
    menuMeta = 'Type / for commands';
    menuFooter = '↵ to open';
    for (const option of optionsFor('skill', index, needle, values)) {
      options.push(option);
    }
  }
  const menuOpen = focused && menuTitle.length > 0;

  const runCommand = async (definition: CommandDefinition, picked: PickedValue[]) => {
    setBusy(true);
    try {
      if (definition.mutate) {
        const preview = await definition.mutate(picked, true);
        let title = `/${definition.id}`;
        for (const value of picked) {
          title += ` ${value.label}`;
        }
        setPlan({ title, steps: preview.steps, command: definition, values: picked });
        return;
      }
      if (definition.act) {
        const message = await definition.act(picked, context);
        if (message.length > 0) {
          toast.push(message, 'ok');
        }
        reset();
      }
    } catch (cause) {
      toast.push(errorMessage(cause, `/${definition.id} failed`), 'error');
    } finally {
      setBusy(false);
    }
  };

  const advance = (definition: CommandDefinition, picked: PickedValue[]) => {
    setValues(picked);
    setText('');
    setActive(0);
    if (picked.length === definition.steps.length) {
      void runCommand(definition, picked);
    }
  };

  const pick = (option: MenuOption) => {
    if (!command && text.startsWith('/')) {
      for (const definition of commands) {
        if (definition.id === option.id) {
          setCommand(definition);
          advance(definition, []);
        }
      }
      return;
    }
    if (command) {
      const picked = [...values, { id: option.id, label: option.label }];
      advance(command, picked);
      return;
    }
    reset();
    navigate(`/skills/${encodeURIComponent(option.id)}`);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && options.length > 0) {
      event.preventDefault();
      setActive((active + 1) % options.length);
      return;
    }
    if (event.key === 'ArrowUp' && options.length > 0) {
      event.preventDefault();
      setActive((active - 1 + options.length) % options.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (command && step && step.kind === 'text' && text.trim().length > 0) {
        advance(command, [...values, { id: text.trim(), label: text.trim() }]);
        return;
      }
      if (options.length > 0) {
        pick(options[Math.min(active, options.length - 1)]);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (command && values.length > 0) {
        setValues(values.slice(0, -1));
        return;
      }
      if (command || text.length > 0) {
        reset();
        setSearch('');
        return;
      }
      inputRef.current?.blur();
    }
  };

  const apply = async () => {
    if (!plan || !plan.command.mutate) {
      return;
    }
    setBusy(true);
    try {
      await plan.command.mutate(plan.values, false);
      refresh();
      toast.push('Done. Type /undo to revert.', 'ok');
      setPlan(null);
      reset();
    } catch (cause) {
      toast.push(errorMessage(cause, 'apply failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  let placeholder = 'Search skills, or type / for commands';
  if (step) {
    placeholder = step.prompt;
  }
  let barClass = 'shell-command-bar';
  if (command) {
    barClass += ' is-command';
  } else if (focused && text.length > 0) {
    barClass += ' is-searching';
  }
  let resultMeta = '';
  if (!command && onSkills && needle.length > 0 && !text.startsWith('/')) {
    resultMeta = 'Filtering list';
  }
  if (command) {
    resultMeta = `Step ${values.length + 1} of ${command.steps.length}`;
  }

  return (
    <div className="shell-command-area">
      {menuOpen && <CommandMenu title={menuTitle} meta={menuMeta} options={options} activeIndex={Math.min(active, Math.max(0, options.length - 1))} onPick={pick} footer={menuFooter} />}
      {!menuOpen && onSkills && <FilterChips index={index} />}
      <div className={barClass}>
        <Search aria-hidden="true" />
        {command && <span className="shell-command-token is-command">{`/${command.id}`}</span>}
        {values.map((value) => <span className="shell-command-token" key={value.id}>{value.label}</span>)}
        <input ref={inputRef} className="shell-command-input" value={text} placeholder={placeholder} aria-label="Search skills or run a command" disabled={busy} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(event) => setSearch(event.target.value)} onKeyDown={onKeyDown} />
        {resultMeta.length > 0 && <span className="shell-command-meta">{resultMeta}</span>}
        {!command && text.length === 0 && <><KeyHint>/</KeyHint><KeyHint>⌘K</KeyHint></>}
        {(command || text.length > 0) && <KeyHint>esc</KeyHint>}
      </div>
      {plan && <PlanDialog title={plan.title} steps={plan.steps} busy={busy} onConfirm={() => void apply()} onCancel={() => setPlan(null)} />}
    </div>
  );
}
```

- [ ] **Step 4: Mount** — in `App.tsx` remove the `CommandPalette` import and element, import `CommandBar` from `../components/command-bar/CommandBar`, and render `<CommandBar />` right after `<div className="app-content">…</div>` inside `<main>`. Delete `CommandPalette.tsx`.

- [ ] **Step 5: Styles** — append to `shell.css`:

```css
/* Command bar — Paper: Shell · Command / * */
.app-main { display: flex; flex-direction: column; background: var(--shell-canvas); background-image: var(--shell-canvas-image); }
.app-content { flex: 1; width: min(100%, 860px); padding: 44px 16px 24px; }
.shell-command-area { position: sticky; bottom: 0; display: flex; flex-direction: column; gap: 8px; width: min(100% - 32px, 760px); margin: 0 auto; padding: 8px 0 24px; }
.shell-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.shell-command-bar { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 14px 0 16px; border: 1px solid var(--shell-control); border-radius: 14px; background: var(--shell-surface); box-shadow: 0 1px 2px rgba(20, 20, 19, 0.04), 0 4px 16px rgba(20, 20, 19, 0.05); }
.shell-command-bar > svg { width: 17px; height: 17px; flex-shrink: 0; color: var(--shell-muted); }
.shell-command-bar.is-searching { border-color: var(--shell-ink-2); }
.shell-command-bar.is-command { border-color: var(--shell-accent-ink); box-shadow: 0 0 0 3px var(--shell-accent-soft); }
.shell-command-input { flex: 1; min-width: 80px; min-height: 0; padding: 0; border: 0; background: transparent; color: var(--shell-ink); font-size: 15px; }
.shell-command-input:focus { outline: none; }
.shell-command-token { padding: 3px 8px; border-radius: 6px; background: var(--shell-hover); color: var(--shell-ink); font-size: 14px; white-space: nowrap; }
.shell-command-token.is-command { background: var(--shell-accent-soft); color: var(--shell-accent-ink); font-weight: 600; }
.shell-command-meta { color: var(--shell-muted); font-size: 12px; white-space: nowrap; }
.shell-command-menu { display: flex; flex-direction: column; padding: 6px; border: 1px solid var(--shell-hairline); border-radius: 12px; background: var(--shell-surface); box-shadow: 0 8px 28px rgba(20, 20, 19, 0.1); }
.shell-command-menu-head { display: flex; justify-content: space-between; padding: 6px 10px 8px; color: var(--shell-muted); font-size: 12px; font-weight: 500; }
.shell-command-menu-foot { margin-top: 4px; padding: 8px 10px 4px; border-top: 1px solid var(--shell-hairline); color: var(--shell-muted); font-size: 12px; }
.shell-command-empty { padding: 8px 10px; color: var(--shell-muted); font-size: 13px; }
.shell-command-menu .shell-menu-item.is-active { background: var(--shell-selected); }
@media (max-width: 720px) { .shell-command-area { padding-bottom: 12px; } }
```

- [ ] **Step 6: Verify** — `bun run typecheck && bun run lint && bun run deadcode`. In Chrome: press ⌘K → bar focused; type `/li` → menu shows `/link`; Enter → skill list; pick one → agent list shows `Already linked` for existing links; pick a detected agent → Plan dialog opens. Click **Cancel** (do not apply). Open a dialog (Edit sidebar) and press ⌘K → focus stays in the dialog.

---

### Task 6: Skill row and Skills page (Paper: Shell · Content / Skill row)

**Files:**
- Create: `apps/web/src/components/shell/SkillRow.tsx`
- Modify: `apps/web/src/pages/SkillsPage.tsx`
- Delete: `apps/web/src/components/SkillCards.tsx` (only if knip confirms no other importer)
- Modify: `apps/web/src/styles/shell.css`

**Interfaces:**
- Consumes: `AgentIcon`, `presentSkill`, URL `q` (Task 5).
- Produces: `SkillRow({ skill, agents, cells })`.

- [ ] **Step 1: SkillRow**

```tsx
// file: apps/web/src/components/shell/SkillRow.tsx
import { Link } from 'react-router-dom';
import type { Agent, Skill, VisibilityCell } from '../../api/client.types';
import { AgentIcon } from '../AgentIcon';
import { presentSkill } from '../skill-presentation';

const MAX_BADGES = 3;
const SCOPE_LABELS: Record<string, string> = { global: 'Global', project: 'Project', plugin: 'Plugin' };

export function visibleAgents(agents: Agent[], cells: VisibilityCell[]): Agent[] {
  const visible = new Set<string>();
  for (const cell of cells) {
    if (cell.state !== 'not-linked' && cell.state !== 'n-a' && cell.state !== 'off') {
      visible.add(cell.agentId);
    }
  }
  const picked: Agent[] = [];
  for (const agent of agents) {
    if (visible.has(agent.id)) {
      picked.push(agent);
    }
  }
  return picked;
}

export function SkillRow({ skill, agents, cells }: { skill: Skill; agents: Agent[]; cells: VisibilityCell[] }) {
  const presentation = presentSkill(skill);
  const readers = visibleAgents(agents, cells);
  const badges: Agent[] = [];
  for (const agent of readers) {
    if (badges.length < MAX_BADGES) {
      badges.push(agent);
    }
  }
  const overflow = readers.length - badges.length;
  let summary = presentation.summary;
  if (summary.length === 0) {
    summary = skill.description;
  }
  return (
    <Link className="shell-skill-row" to={`/skills/${encodeURIComponent(skill.id)}`}>
      <span className="shell-skill-copy">
        <span className="shell-skill-name">{skill.name}</span>
        <span className="shell-skill-summary">{summary}</span>
      </span>
      <span className="shell-skill-agents">
        {badges.map((agent) => <span className="shell-agent-badge" title={agent.name} key={agent.id}><AgentIcon id={agent.id} name={agent.name} /></span>)}
        {overflow > 0 && <span className="shell-agent-badge is-overflow">{`+${overflow}`}</span>}
      </span>
      <span className="shell-skill-scope">{SCOPE_LABELS[skill.scope] ?? skill.scope}</span>
    </Link>
  );
}
```

- [ ] **Step 2: SkillsPage** — in `SkillsPage.tsx`:
  - remove `useState` for `query`, the `Search` icon import, the `inventory-toolbar` block, `SkillCards` import;
  - read `let query = params.get('q'); if (!query) { query = ''; }` next to the other params;
  - replace `<SkillCards … />` with:

```tsx
      <div className="shell-skill-list">
        {filtered.map((skill) => <SkillRow key={skill.id} skill={skill} agents={index.agents} cells={index.cells[skill.id] ?? []} />)}
        {filtered.length === 0 && <p className="empty-state">No skills match. Press esc in the bar below to clear the search.</p>}
      </div>
```

  - add a scope `SegmentedTabs` to the page header actions, bound to `?scope=`:

```tsx
          <SegmentedTabs<string> label="Scope" value={scope} onChange={(value) => {
            const next = new URLSearchParams(params);
            if (value.length > 0) {
              next.set('scope', value);
            } else {
              next.delete('scope');
            }
            setParams(next);
          }} options={[{ value: '', label: 'All' }, { value: 'global', label: 'Global' }, { value: 'project', label: 'Project' }, { value: 'plugin', label: 'Plugin' }]} />
```

  (change `const [params] = useSearchParams();` to `const [params, setParams] = useSearchParams();`, keep the existing rescan `IconButton`.)
  - when `query.length > 0`, set the count text to `${filtered.length} of ${index.skills.length} match “${query}”`.

- [ ] **Step 3: Styles** — append to `shell.css`:

```css
/* Skill row — Paper: Shell · Content / Skill row */
.shell-skill-list { display: flex; flex-direction: column; border-top: 1px solid var(--shell-hairline); }
.shell-skill-row { display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-bottom: 1px solid var(--shell-hairline); border-radius: 0; color: inherit; text-decoration: none; }
.shell-skill-row:hover, .shell-skill-row:focus-visible { background: var(--shell-hover); border-radius: 8px; }
.shell-skill-copy { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.shell-skill-name { color: var(--shell-ink); font-size: 14px; font-weight: 500; }
.shell-skill-summary { overflow: hidden; color: var(--shell-muted); font-size: 13px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.shell-skill-agents { display: flex; justify-content: flex-end; gap: 4px; width: 96px; flex-shrink: 0; }
.shell-agent-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 4px; border: 1px solid var(--shell-hairline); border-radius: 6px; background: var(--shell-surface); color: var(--shell-ink-2); font-size: 11px; font-weight: 600; box-sizing: border-box; }
.shell-agent-badge .agent-icon, .shell-agent-badge .agent-icon-art { width: 13px; height: 13px; }
.shell-skill-scope { width: 56px; flex-shrink: 0; color: var(--shell-ink-2); font-size: 12px; text-align: right; }
.skills-page .page-header { align-items: flex-end; margin-bottom: 18px; }
.skills-page h1 { font-size: 28px; letter-spacing: -0.02em; }
@media (max-width: 640px) { .shell-skill-agents { display: none; } }
```

- [ ] **Step 4: Verify** — typecheck, lint, deadcode (delete `SkillCards.tsx` when knip reports it unused), build. In Chrome type `timeline` in the bar on /skills → list filters live and the URL has `?q=timeline`; Esc clears.

---

### Task 7: Settings → Appearance (Paper screen 06, Shell · Controls / Colour field, Theme card)

**Files:**
- Create: `apps/web/src/pages/settings/AppearanceSettings.tsx`
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/styles/shell.css`

**Interfaces:**
- Consumes: `THEME_PRESETS`, `CUSTOM_PRESET_ID`, `DEFAULT_APPEARANCE`, `applyAppearance`, `presetAppearance` (Task 2); `ThemeCard`, `ColourField`, `Switch`, `SegmentedTabs` (Task 3); `api.putConfig({ appearance })` (Task 1).
- Produces: `AppearanceSettings({ initial }: { initial: AppearanceConfig })`.

- [ ] **Step 1: AppearanceSettings**

```tsx
// file: apps/web/src/pages/settings/AppearanceSettings.tsx
import { useRef, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import type { AppearanceConfig, AppearanceDensity } from '../../api/client.types';
import { ColourField } from '../../components/shell/ColourField';
import { SegmentedTabs } from '../../components/shell/SegmentedTabs';
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
      <div className="shell-field-row">
        <span className="shell-field-copy"><strong>Accent</strong><span>Selected rows, primary buttons, focus ring.</span></span>
        <ColourField label="Accent" value={appearance.accent} onChange={(value) => editColour('accent', value)} />
      </div>
      <div className="shell-field-row">
        <span className="shell-field-copy"><strong>Sidebar</strong><span>Background of the left panel.</span></span>
        <ColourField label="Sidebar" value={appearance.sidebar} onChange={(value) => editColour('sidebar', value)} />
      </div>
      <div className="shell-field-row">
        <span className="shell-field-copy"><strong>Background gradient</strong><span>Canvas behind pages. Turn off for a flat colour.</span></span>
        <span className="shell-field-controls">
          <ColourField label="Gradient start" value={appearance.gradientFrom} onChange={(value) => editColour('gradientFrom', value)} />
          <span aria-hidden="true">→</span>
          <ColourField label="Gradient end" value={appearance.gradientTo} onChange={(value) => editColour('gradientTo', value)} />
          <Switch label="Use gradient background" checked={appearance.gradient} onChange={(gradient) => update({ ...appearance, gradient })} />
        </span>
      </div>
      <div className="shell-field-row">
        <span className="shell-field-copy"><strong>Density</strong><span>Row height in the sidebar and lists.</span></span>
        <SegmentedTabs<AppearanceDensity> label="Density" value={appearance.density} onChange={(density) => update({ ...appearance, density })} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
      </div>
      <div className="shell-appearance-foot">
        <span>Theme is saved per machine in ~/.skillet/config.json. Export it to share.</span>
        <button type="button" className="button-link" onClick={exportTheme}>Export theme</button>
        <button type="button" onClick={() => update({ ...DEFAULT_APPEARANCE })}>Reset to Straw</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SettingsPage tabs** — in `SettingsPage.tsx` add `const [tab, setTab] = useState<'general' | 'scanning' | 'appearance'>('general');`; below the page header render

```tsx
      <SegmentedTabs<'general' | 'scanning' | 'appearance'> label="Settings section" value={tab} onChange={setTab} options={[{ value: 'general', label: 'General' }, { value: 'scanning', label: 'Scanning' }, { value: 'appearance', label: 'Appearance' }]} />
      {tab === 'appearance' && <AppearanceSettings initial={config.appearance} />}
```

and wrap the existing `settings-panel` in `{tab !== 'appearance' && (…)}` (General and Scanning both show today's fields until they are split in a later change). Change the header description to `Stored in ~/.skillet/config.json.`

- [ ] **Step 3: Styles** — append to `shell.css`:

```css
/* Settings → Appearance */
.shell-appearance { display: flex; flex-direction: column; margin-top: 22px; }
.shell-appearance-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.shell-appearance-head h2 { font-size: 15px; font-weight: 600; }
.shell-appearance-head span { color: var(--shell-muted); font-size: 13px; }
.shell-theme-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.shell-field-row { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-top: 1px solid var(--shell-hairline); }
.shell-field-copy { display: flex; flex: 1; flex-direction: column; gap: 2px; }
.shell-field-copy strong { color: var(--shell-ink); font-size: 14px; font-weight: 500; }
.shell-field-copy span { color: var(--shell-muted); font-size: 13px; }
.shell-field-controls { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--shell-muted); }
.shell-appearance-foot { display: flex; align-items: center; gap: 12px; padding-top: 16px; border-top: 1px solid var(--shell-hairline); color: var(--shell-muted); font-size: 13px; }
.shell-appearance-foot span { flex: 1; }
.shell-appearance-foot .button-link { min-height: 34px; padding: 0 6px; border: 0; background: none; color: var(--shell-ink-2); }
@media (max-width: 640px) { .shell-field-row { flex-direction: column; align-items: flex-start; } }
```

- [ ] **Step 4: Verify** — typecheck, lint, deadcode. In Chrome open Settings → Appearance, click **Sage**: the whole app re-themes immediately and `~/.skillet/config.json` shows `"preset": "sage"` after ~0.5 s; click **Reset to Straw** to restore. (This writes only the appearance key of the user's own config, which is the feature under test; restore Straw afterwards.)

---

### Task 8: Whole-app pass

**Files:**
- Modify: `apps/web/src/styles/base.css` (only if a legacy rule fights the shell: `.sidebar` width/padding and `.sidebar-link` sizing are superseded by `.shell-*`)

- [ ] **Step 1: Quality** — Run `bun run quality` → lint, typecheck, deadcode, unit tests (same 15 pre-existing failures, no new ones), build all pass.
- [ ] **Step 2: Screens** — Chrome screenshots at 1440×900: All skills, `/link` pick-agent step (preview dialog open, then Cancel), Edit sidebar → Projects tab, collapsed sidebar with More open, search `timeline`, Settings → Appearance. Compare with Paper page "0.1.0 — Claude shell"; fix spacing or colour drift in `shell.css`.
- [ ] **Step 3: Narrow** — 375×812 screenshot of /skills: no horizontal scroll, bar visible.
- [ ] **Step 4: Review Focus checks** — (a) set `"accent": "yellow"` in config via the PUT in Task 1 Step 6 → UI stays Straw; (b) stop the server, change a theme → toast error, theme stays; restart; (c) Chrome DevTools → block storage for the origin → sidebar collapse still toggles; (d) ⌘K with Edit sidebar open → focus stays in dialog; (e) Edit sidebar → Hide all → Save → sidebar shows "Choose agents" / "Choose projects".
