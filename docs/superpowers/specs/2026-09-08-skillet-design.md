# Skillet — Agent Skills Control Panel

Date: 2026-09-08
Status: draft for review
Location: `~/Desktop/skillet`

## 1. Purpose

Local web app that scans every place AI coding agents load skills from, shows each skill once with every location it lives in, tells which agent can see it under which condition, and lets the user read, edit, rename, delete, move, link, copy, and change trigger behaviour from one screen.

Reference tools studied: jiweiyeah/Skills-Manager (hub + symlinks, 32 tools, desktop), abubakarsiddik31/skill-manager (project folders, "seen by" label, disable via `.disabled/`), vercel-labs/skills (`npx skills`, 76-agent path registry, symlink or copy install). Skillet must exceed them on: git worktree awareness, project scopes with every agent dir, visibility matrix with condition text, per-agent trigger editing, plugin skills, git status, content-hash dedupe migration, trash + undo, live filesystem watch, diff of diverged copies.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Runtime | Bun + Hono API, Vite + React 19 + TypeScript SPA, `bun dev` runs both |
| Agents | All 76 from the `npx skills` registry, installed ones auto-detected and listed first |
| Global scope model | Hub + symlinks. Canonical copy in `~/.skillet/hub/<skill>/`, each agent global dir gets one symlink per skill |
| Project scope model | No forced canonical dir. Every registry projectDir under a repo is scanned. The dir holding real files is canonical for that skill. Other agent dirs in the same repo get relative symlinks to it |
| Persistence | Filesystem is truth. In-memory index rebuilt by scanner. `~/.skillet/config.json` for settings only. No database |
| Styling | Notion-style, plain CSS with tokens, light and dark via `prefers-color-scheme`. No Tailwind |
| Editor | CodeMirror 6 |
| Tests | None (user rule). Verification by running against real dirs |
| Commits | Never automatic |

## 3. Repository layout

```
skillet/
  package.json                 bun workspaces: server, web; scripts: dev, build, start
  server/
    package.json
    src/index.ts               boot Hono, mount routes, start watcher, SSE hub
    src/config/                load and save ~/.skillet/config.json, defaults
    src/registry/agents.json   76 agents (id, name, globalDir, projectDir, legacyGlobalDirs, legacyProjectDirs, detect)
    src/registry/resolve.ts    env expansion ($HOME, $XDG_CONFIG_HOME, $CLAUDE_CONFIG_DIR, $CODEX_HOME), detect installed
    src/scan/walk.ts           directory walker, depth limit, ignore list
    src/scan/frontmatter.ts    YAML frontmatter parse and serialise, spec validation
    src/scan/git.ts            git root, branch, worktree list, per-path status
    src/scan/plugins.ts        Claude plugin skills from installed_plugins.json + enabledPlugins
    src/scan/index-builder.ts  instances to logical skills, hashes, diverged, shadowed
    src/scan/watcher.ts        chokidar, debounce, partial rescan, emit events
    src/visibility/            one file per agent family with special rules, one generic rule file
    src/hub/adopt.ts           migration plan and apply
    src/hub/link.ts            create and remove symlinks, relative for project scope
    src/hub/move.ts            move between global hub and repo dirs
    src/hub/copy.ts            copy as link or as independent copy
    src/hub/rename.ts          dir + name field + relink
    src/hub/trash.ts           trash and restore
    src/hub/trigger.ts         frontmatter fields, Claude skillOverrides, Codex config.toml
    src/hub/journal.ts         append and undo
    src/hub/preflight.ts       shared guards
    src/routes/                one file per resource
    src/errors.ts              SkilletError
    src/types.ts               shared server types
  web/
    package.json
    index.html
    src/main.tsx
    src/app/                   router, layout, theme
    src/api/                   typed fetch client, SSE subscriber
    src/pages/                 Skills list, Skill detail, Agents, Adopt wizard, Trash, Settings
    src/components/            Sidebar, SkillTable, VisibilityGrid, InstanceList, DiffView, FrontmatterForm, Editor, CommandPalette, Badge, Toast
    src/styles/tokens.css, base.css
  docs/superpowers/specs/, docs/superpowers/plans/
```

Every source file stays under 500 lines. Types live in `*.types.ts` next to their consumers when a file would otherwise exceed that.

## 4. Agent registry

Source: vercel-labs/skills `src/agents.ts`, transcribed to `agents.json`. Fields per agent:

```
id, name,
globalDir      string | null   (may contain $HOME, $XDG_CONFIG_HOME, $CLAUDE_CONFIG_DIR, $CODEX_HOME, $VIBE_HOME, ...)
projectDir     string          (relative to repo root or nested dir)
legacyGlobalDirs   string[]    (Codex: ~/.codex/skills)
legacyProjectDirs  string[]    (Cursor: .claude/skills, .codex/skills)
detect         { anyOf: string[] }   (paths; env-var paths allowed)
overrideSource "claude" | "codex" | null
```

Known specifics baked in:

- Claude Code: global `$CLAUDE_CONFIG_DIR/skills` (default `~/.claude/skills`), project `.claude/skills`, nested dirs give scoped skills, plugins from `~/.claude/plugins`, overrides in `<repo>/.claude/settings.local.json` `skillOverrides` (on, name-only, user-invocable-only, off), priority personal > project > plugin.
- Codex: project `.agents/skills` (cwd and repo root), global `~/.agents/skills`, legacy global `~/.codex/skills`, disable via `~/.codex/config.toml` skills config entries.
- Cursor: project `.agents/skills` and `.cursor/skills`, global `~/.agents/skills` and `~/.cursor/skills`, legacy reads `.claude/skills`, `.codex/skills`, `~/.claude/skills`, `~/.codex/skills`. Nested auto scoped.
- Universal: `.agents/skills` project, `$XDG_CONFIG_HOME/agents/skills` global, never detected as installed, always offered as a link target.

User can add a custom agent (name, globalDir, projectDir) from Settings. Stored in config.json, merged into registry at boot.

## 5. Data model (server, in memory)

```
Agent          id, name, globalDir, projectDir, legacyGlobalDirs, legacyProjectDirs, installed, overrideSource, custom
Repo           id, gitRoot, branch, isWorktree, mainCheckout, worktrees: RepoRef[], dirty
SkillInstance  id, absPath, kind: canonical | symlink | copy | plugin,
               scope: global | project | plugin,
               readers: agentId[], repoId | null, nestedDir | null,
               symlinkTarget | null, contentHash, frontmatter, body, files: string[],
               gitStatus: tracked | modified | untracked | ignored | none,
               errors: ValidationError[]
Skill          id (name + scope + repoId), name, canonical: SkillInstance, instances: SkillInstance[],
               diverged, shadowed, pluginName | null, pluginVersion | null
VisibilityCell agentId, state: auto | user-only | model-only | name-only | off | not-linked | n-a,
               conditions: string[], actions: Action[]
Index          agents, repos, skills, cells: Record<skillId, VisibilityCell[]>, scannedAt, stalePluginVersions
```

Readers for an instance = every agent whose globalDir, projectDir, legacyGlobalDirs, or legacyProjectDirs resolves to the instance parent dir.

Logical grouping: instances with identical `name` inside the same repo form one project Skill. Global instances (hub, agent global dirs, legacy global dirs) with identical `name` form one global Skill. Plugin instances form one Skill per plugin + name. `diverged` when any two instances differ by hash. `shadowed` when a Claude project or plugin skill shares a name with a global one.

## 6. Scanner

1. Load config: hub path (`~/.skillet/hub`), project roots (default `~/Desktop/crm`), max depth (default 6), ignore (`node_modules`, `.git`, `dist`, `build`, `.runtime` optional toggle).
2. Resolve agents, detect installed.
3. Global pass: list child dirs of hub, every agent globalDir, every legacyGlobalDir. Each child with `SKILL.md` is an instance. `lstat` decides symlink vs real.
4. Project pass: under each project root, find git roots (dir containing `.git` file or dir). For each git root run `git worktree list --porcelain` once, group worktrees under main checkout. Walk each checkout up to max depth; at every dir check every registry projectDir and legacyProjectDir. Instance gets `nestedDir` when its repo-relative parent is not the repo root.
5. Plugin pass: read `~/.claude/plugins/installed_plugins.json` and `~/.claude/settings.json` enabledPlugins. Active install path per enabled plugin. Each `skills/*/SKILL.md` is a plugin instance. Other cached versions counted as stale.
6. Parse every `SKILL.md`: frontmatter via `yaml`, body text, sha256 of frontmatter + body + sorted file list of the skill dir (excluding `.DS_Store`). Validate against agentskills.io spec: name regex `^[a-z0-9]+(-[a-z0-9]+)*$`, max 64, name equals dir name, description 1 to 1024, body under 500 lines warning.
7. Git status: one `git status --porcelain --ignored -- <paths>` per checkout, bulk, mapped back.
8. Build index, compute visibility cells, emit `index` event.

All directory reads and file reads inside a pass run with `Promise.all` over collected paths. No `await` inside loops.

Watcher: chokidar on hub, agent global dirs, project roots (ignoring the ignore list), 300 ms debounce, rescan only the affected checkout or global dir, then rebuild index and emit.

## 7. Visibility rules

Per (skill, agent):

- Agent not installed and not custom: `n-a` unless user toggled "show all agents".
- No instance readable by agent: `not-linked`, action `link`.
- Readable instance exists, then state by agent family:
  - Claude: start `auto`. `skillOverrides[name]` maps name-only, user-invocable-only to `user-only`, off to `off`. Frontmatter `disable-model-invocation: true` gives `user-only`; `user-invocable: false` gives `model-only`. `paths` adds condition `editing <glob>`. Project instance adds `cwd inside <repo>`; nested adds `editing under <nestedDir>`. Plugin adds `plugin <name> enabled`. Shadowed adds `shadowed by global <name>`.
  - Codex: `auto`. config.toml disabled entry gives `off`. Project adds `cwd inside <repo>`. Legacy global dir adds condition `legacy dir ~/.codex/skills`.
  - Cursor: `auto`. `disable-model-invocation: true` gives `user-only`. `paths` and nested conditions as Claude. Legacy project dir adds `via .claude/skills compat`.
  - Generic agent: `auto`, project condition only.
- Cell actions: link, unlink, set trigger, open instance.

## 8. Operations

Every mutating endpoint accepts `dryRun: true` and returns the planned filesystem steps. UI shows the plan, then applies. Every applied op appends a journal entry with inverse steps.

| Op | Steps | Notes |
|---|---|---|
| Edit content | write SKILL.md atomically (tmp + rename) | validate before write; refuse when name in frontmatter differs from dir unless rename op |
| Rename | rename dir, set `name`, recreate every symlink pointing at old path | refuse on conflict |
| Trash | move dir to `~/.skillet/trash/<iso>/<name>`, remove symlinks pointing at it | restore reverses; plugin skills refuse |
| Link (global) | symlink `<agent globalDir>/<name>` to `<hub>/<name>` | canonical must be in hub, else offer adopt first |
| Link (project) | relative symlink `<repo>/<agent projectDir>/<name>` to canonical dir in same repo | never absolute |
| Unlink | remove symlink only | refuse when target is a real dir |
| Copy | mode `link` = link op; mode `copy` = recursive copy, new independent instance | target scope global or repo |
| Move | global to repo: move hub dir into chosen agent projectDir, drop global symlinks, offer relinks; repo to global: move into hub, leave relative symlink in origin dir if user wants, link chosen agents | warn when git-tracked |
| Trigger | write frontmatter fields; write Claude `skillOverrides` in `<repo>/.claude/settings.local.json` or `~/.claude/settings.local.json`; write Codex config.toml skills entry | preserve unrelated keys, TOML via `smol-toml` |
| Adopt | plan: group global instances by hash; identical group becomes one hub dir plus symlinks; conflicting names with different hashes shown side by side, user picks winner per name, losers copied to trash | project instances untouched by adopt |
| Undo | pop journal, apply inverse steps | last 50 |

Preflight for every op: path inside allowed roots (hub, agent dirs, project roots, trash), source exists, dest free or 409 with choices (overwrite, skip, keep both), symlink targets resolved with `realpath` and checked inside roots, never `rm -rf` through a symlink, plugin dirs read-only.

Git: read-only. Badges only. User commits.

## 9. API

```
GET  /api/index                         full index
GET  /api/skills/:id                    skill with bodies of every instance
PUT  /api/skills/:id/content            { instanceId, frontmatter, body, dryRun }
POST /api/skills/:id/rename             { newName, dryRun }
POST /api/skills/:id/trash              { dryRun }
POST /api/skills/:id/link               { agentId, scope, repoId, dryRun }
POST /api/skills/:id/unlink             { instanceId, dryRun }
POST /api/skills/:id/copy               { target: { agentId, scope, repoId }, mode, dryRun }
POST /api/skills/:id/move               { to: { scope, repoId, agentId }, dryRun }
POST /api/skills/:id/trigger            { agentId, changes, dryRun }
GET  /api/skills/:id/diff               { a: instanceId, b: instanceId }  unified diff
GET  /api/trash                          entries
POST /api/trash/:entryId/restore
GET  /api/journal                        entries
POST /api/journal/undo
POST /api/adopt/plan                    returns plan
POST /api/adopt/apply                   { decisions }
GET  /api/agents
PUT  /api/agents/custom                  add or edit custom agent
GET  /api/config
PUT  /api/config                         roots, hub path, ignore, showAllAgents
POST /api/rescan
GET  /api/events                         SSE: index, op, error
```

Errors: Hono `onError` maps `SkilletError` to `{ code, message, method, service }` JSON with 4xx or 500. Conflicts 409 with `choices`.

## 10. UI

Layout: fixed left sidebar 260 px, content column max 1100 px, top bar with breadcrumb and ⌘K.

Sidebar groups:
- Scopes: Global hub (count), each repo (name, branch, worktree count, dirty dot), Plugins, Trash.
- Agents: installed first with dot, then "show all" toggle to reveal remaining registry agents.
- Filters: diverged, invalid, shadowed, untracked, not linked to selected agent.

Skills list page: table rows with name, description clipped to two lines, scope chip, agent chips (ordered by installed), badges. Row click opens detail. Bulk select for link, unlink, trash.

Skill detail page tabs:
- Content: frontmatter form (known fields per readers, free key-value rows for extras) above CodeMirror markdown body, live preview toggle, save with dry-run diff shown first.
- Visibility: grid agents × state. Each cell shows state pill and condition lines. Click cell for actions.
- Instances: every path, kind, hash short, git badge, worktree branch, open in editor, diff any two.
- Triggers: per agent controls (Claude override select, disable-model-invocation, user-invocable, paths list, Codex enabled toggle).
- History: journal entries for this skill, undo when it is the latest.

Other pages: Agents (registry table, detection result, custom agent form), Adopt wizard (plan groups, conflict chooser, apply), Trash (restore, purge), Settings (roots, hub, ignore, depth).

Visual: Notion style. System font stack, 14 px base, 8 px spacing grid, one accent colour, neutral greys, hairline borders, hover reveals actions, no heavy shadows. Tokens in `tokens.css`, dark values under `prefers-color-scheme: dark`.

Live: SSE updates index in place with a toast when an external change touched the open skill.

## 11. Code rules (from user CLAUDE.md, applied to both packages)

- No ternaries. `if`/`else` or early return.
- No `.filter().map()` chains. Single loop with guard and `push`.
- No `await` inside loops. Collect then `Promise.all`.
- Async functions wrap body in try/catch and rethrow `SkilletError { message, method, service, error }`. Sync functions bare.
- No explicit `any` or `undefined` in types. `Record<string, unknown>` for open maps.
- No local alias for injected dependencies.
- No code comments.
- Files under 500 lines. Types in `*.types.ts`, constants in `*.constants.ts` when they grow.
- No test files.

## 12. Verification (manual, against real machine)

1. `bun dev` boots, UI at localhost, index in under 3 s for `~/Desktop/crm` with 17 worktrees.
2. Global list shows 30 Claude, 25 Codex entries collapsed to 31 logical skills, 24 marked identical twins, 0 diverged.
3. Adopt plan proposes 31 hub dirs, 0 conflicts. After apply, `~/.claude/skills/*` and `~/.codex/skills/*` are symlinks, `claude` still lists every skill.
4. crm-server shows 4 project skills, worktree count equal to `git worktree list`, Cursor reader via compat, Codex not-linked with link action. Linking creates `.agents/skills/<name>` relative symlink, `git status` shows it untracked.
5. Editing description in UI changes file, watcher reflects external edit within 1 s.
6. Trigger tab sets `disable-model-invocation`, cell flips to user-only. Claude override set writes `settings.local.json` without touching other keys.
7. Trash then restore round-trips. Undo reverses a rename.
8. Plugin skills listed read-only with version, stale cache count matches `ls ~/.claude/plugins/cache/*/*`.

## 13. Out of scope for v1

Marketplace or remote install, Windows junctions, git commits from the app, skill evals, usage stats, multi-user, auth, publishing skillet as a package.
