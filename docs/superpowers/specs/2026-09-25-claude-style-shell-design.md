# Claude-style shell: sidebar, light theme, command bar

Date: 2026-09-25
Status: approved in conversation, awaiting spec review

## Intent

Make Skillet feel like the Claude desktop app (and ChatGPT / Cursor): a clean, dense sidebar, a muted-yellow light theme that users can re-colour, and a bottom search-and-command bar. Every existing capability stays; only the shell and the way actions are reached change. No AI features, no dark mode.

Success: finding, filtering and acting on a skill needs no hunting. Sidebar rows are dense, menus are popovers, and every write still goes through preview, apply and undo.

## Out of scope

- Any Claude or LLM call from Skillet.
- Dark mode (the app stays light when the OS asks for dark). Custom themes are light only.
- Reworking the Skills page cards, Skill detail, Discover, Adopt, Trash and Settings layouts beyond what the new tokens restyle.
- New tests (repository owner instruction).

## 1. Theme: muted yellow by default, user-customisable

Design reference: Paper file "Skillet — 0.0.4", pages "0.1.0 — Claude shell" (six screens) and "0.1.0 — Shell components"; the same component sheet is in "Components — Shared UI Library" on page "Skillet shell · Straw (0.1.0)".

Every colour is a `--shell-*` token in `apps/web/src/styles/shared-ui.css`, mapped from `tokens.css`. A theme is only a set of token values. Default preset **Straw**:

| Token | Value | Use |
|---|---|---|
| `--shell-canvas` | `#FEFDF9` | page background |
| `--shell-sidebar` | `#FAF8F1` | sidebar |
| `--shell-surface` | `#FFFFFF` | cards, popovers, dialogs, command bar |
| `--shell-ink` / `-ink-2` / `-muted` | `#28303D` / `#515966` / `#606876` | text |
| `--shell-hairline` / `-control` | `#ECE8DC` / `#D6D0BE` | borders |
| `--shell-hover` / `-selected` | `#F4F0E4` / `#EEE7D3` | row states |
| `--shell-accent` | `#E8DBAE` | primary buttons |
| `--shell-accent-soft` | `#F4EEDB` | focus halo, command tokens |
| `--shell-accent-ink` | `#7A6528` | accent text, focus border |
| `--shell-on-accent` | `#463A17` | text on accent |
| `--shell-gradient-from` / `-to` | `#FEFDF9` / `#FAF5EE` | canvas gradient (135deg) |
| `--shell-detected` | `#15803D` | detected-agent dot |

Presets (accent, sidebar, gradient from → to): Straw `#E8DBAE`, `#FAF8F1`, `#FEFDF9 → #FAF5EE`; Lemon `#FFE67A`, `#FFFCEE`, `#FFFEF8 → #FFF4F9`; Sage `#C9D8BF`, `#F4F6F1`, `#FBFCF9 → #EEF3EA`; Sky `#C7D7EE`, `#F3F6FA`, `#FBFCFE → #EDF2FA`; Clay `#E3B9A6`, `#F3F1EA`, `#FAF9F5 → #F6EEE8`; Graphite `#D5D6DA`, `#F2F2F3`, `#FBFBFB → #F1F1F3`. Derived tokens (hover, selected, accent-soft, accent-ink, on-accent) are computed from the preset's accent and sidebar in `theme.ts`.

Surfaces are flat with a 1px border; soft shadows only on popovers and dialogs. Font stays the system sans stack (AGENTS.md).

### Settings → Appearance

A new Appearance tab in Settings (next to General and Scanning):

- **Theme**: six preset cards with a mini preview; the active one has an accent-ink border and a check.
- **Accent**, **Sidebar**: colour swatch + hex input.
- **Background gradient**: from and to swatches + hex inputs, and a switch; off means a flat canvas colour.
- **Density**: Comfortable (32px rows) / Compact (28px rows).
- **Export theme** (downloads the theme JSON) and **Reset to Straw**.

Changes apply instantly by writing the CSS variables on `:root`. The theme persists as `appearance: { preset, accent, sidebar, gradientFrom, gradientTo, gradient, density }` in `~/.skillet/config.json`; saving only `appearance` skips the rescan, like `sidebarAgents`. The server validates hex values and falls back to Straw on anything invalid.

## 2. Sidebar

`Sidebar.tsx` becomes a thin composition of focused components. Existing class names used by browser tests (`.sidebar-link`, `.sidebar-link-label`, `.agent-filter`) are kept.

Top to bottom:

1. **Header**: 24px Skillet mark, collapse toggle, rescan icon button. Collapsed state is a per-viewer preference in `localStorage` (wrapped in try/catch; defaults to expanded). Collapsed width shows icons only, with tooltips.
2. **Primary links** (32px rows, 16px icons, 14px text):
   - `Search skills` with a `⌘K` hint; focuses the command bar.
   - `All skills` with the skill count.
   - `Find skills` (Discover).
   - `Adopt into hub`.
3. **More** row with a chevron opens a popover menu: `All agents`, `Trash`, `Settings`, divider, `Edit sidebar…`. `Edit sidebar…` opens a dialog with two tabs, Agents and Projects, reusing the picker built for agents.
4. **Agents section**: collapsible heading `Agents`. Hover actions: `+` (opens the picker on the Agents tab) and a filter icon that shows a small inline input filtering the rows. Rows: icon, name, a 6px detected dot (green when detected, hidden otherwise), and a hover `×` that hides the agent from the sidebar. Active row: selection pill. Contents follow `sidebarAgents` (already implemented).
5. **Projects section**: collapsible heading `Projects`, same hover actions as Agents. One row per shown repository: folder or git-branch icon, label, skill count. Clicking filters with `?repo=<id>`. Hover `×` hides the project.
   - Default when nothing is saved: main checkouts that contain at least one skill (worktrees and zero-skill repos such as submodule copies hidden), sorted by skill count, first 8 visible with `Show all` / `Show less`. Repeated submodule copies with the same name collapse into one row in the Edit sidebar dialog.
   - Hide and show are persisted as `sidebarRepos: string[] | null` in `~/.skillet/config.json` (null means the default rule), mirroring `sidebarAgents`. Saving only this key skips the rescan, like `sidebarAgents` does.
6. **Footer**: machine status, not an account (Skillet has no users): laptop icon, `This Mac`, a detected-colour dot with `Watching` while the file watcher runs, and `N repos · scanned X s ago`. Clicking it opens a popover with the hub path and stale plugin cache count; a settings icon links to Settings. The collapsed rail shows the laptop icon instead.

Section collapse state (Agents, Projects) is a per-viewer `localStorage` preference.

## 3. Command bar

A bar pinned to the bottom of the main column on every route, centered, max 760px. It has a leading search icon and trailing `/` and `⌘K` key hints, and no send button, since nothing is sent anywhere. It replaces `CommandPalette.tsx`, which is deleted. `⌘K` focuses the bar from anywhere; if a dialog is open, `⌘K` does nothing (current behavior).

### Modes

- **Search** (plain text). On `/skills` the typed text drives the page's text filter through the URL (`?q=`), live. The page's own search input (local `query` state today) is removed so there is one search box. On other routes a results menu opens above the bar with up to 8 skills (title, name, scope). Arrow keys move, Enter opens the skill, Esc closes the menu.
- **Commands** (text starting with `/`). A menu of commands opens above the bar, filtered as you type. Choosing one enters its steps; each step shows a pick list (skills, agents, projects) or a text field, with the chosen values shown as tokens inside the bar. Esc steps back once; Esc on an empty bar blurs it.

### Commands

| Command | Steps | Action |
|---|---|---|
| `/link` | skill, agent | `api.link` |
| `/copy` | skill, agent or project | `api.copy` (mode `copy`) |
| `/move` | skill, agent or project | `api.move` |
| `/rename` | skill, new name | `api.rename` |
| `/trash` | skill | `api.trash` |
| `/adopt` | none | navigate to `/adopt` |
| `/agent` | agent | set `?agent=` |
| `/repo` | project | set `?repo=` |
| `/rescan` | none | `api.rescan` |
| `/settings`, `/trash-bin`, `/agents` | none | navigate |

Every mutating command first calls its endpoint with `dryRun: true` and shows the existing `PlanDialog`. Apply runs it with `dryRun: false`; the success toast offers Undo through `api.undo` with the returned `journalId`. Errors surface in the toast with the server message; the bar keeps its tokens so the user can retry or edit.

### Filter chips

A row above the bar shows the active filters from the URL (`agent`, `repo`, `scope`, `hub`) as chips with a remove `×`. A `+` chip opens a popover to add one. Chips, sidebar and page read the same URL parameters, so they never disagree.

## 3a. Agent logos

Agent icons use the brand SVGs in `apps/web/public/agent-icons` in their brand colours (Claude Code `#D97757`, others their mark colour). Codex uses the OpenAI/ChatGPT mark (`openai.svg`) instead of `codex.svg`; `agent-logo-map.ts` maps `codex` to `openai`.

## 4. Components and files

New, under `apps/web/src/components`:

- `Popover.tsx`: anchored menu primitive (click outside and Esc close, focus returns to the trigger, `role="menu"` / `menuitem`, arrow-key navigation). Used by More, footer, chips and command menus.
- `SidebarSection.tsx`: collapsible heading with hover actions and persisted collapse state.
- `SidebarProjects.tsx`: Projects section.
- `SidebarFooter.tsx`.
- `SidebarPickerDialog.tsx`: the Edit sidebar dialog with Agents and Projects tabs (the agent picker dialog moves here from `SidebarAgentFilters.tsx`).
- `theme/theme.ts` (presets, derivation, apply to `:root`) and `pages/settings/AppearanceSettings.tsx`.
- `command-bar/CommandBar.tsx`, `command-bar/CommandMenu.tsx`, `command-bar/commands.ts`, `command-bar/FilterChips.tsx`.

Changed: `SettingsPage.tsx` (tabs, Appearance), `agent-logo-map.ts`, `Sidebar.tsx`, `SidebarAgentFilters.tsx`, `App.tsx` (mount the bar, drop the palette), `SkillsPage.tsx` (read `?q=`), styles, config types on server and client (`sidebarRepos`, `appearance`), `config.ts` merge, `config-route.ts` (skip rescan for sidebar-only patches).

Each new file stays under 500 lines. Code follows the owner's style rules: no ternaries where an `if` works, no `.filter().map()` chains, no explicit `undefined` or `any`.

## 5. Verification

- `bun run typecheck`, `bun run lint`, `bun run deadcode`, `bun run build`.
- `bun run test:unit` must show no new failures beyond the 15 that fail on the current base.
- Screenshots through local Chrome: expanded and collapsed sidebar, More menu, Edit sidebar dialog on both tabs, search results, `/` menu, a `/link` preview dialog, filter chips, and a 375px-wide view with no horizontal scroll.
- Browser checks only exercise read-only flows; `/link` is verified up to the preview dialog, not applied.
