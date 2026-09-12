<img src="apps/web/public/brand/skillet.png" alt="Skillet" width="180" />

**Your personal, curated library of AI coding agent skills.**

The [Skillet 0.0.6 product brief](docs/product/Skillet-0.0.6.md) defines the current scope: your selected skills, project and agent availability, invocation settings, and portable sharing. The later [Find skills extension](docs/product/Skillet-catalog-import.md) adds selected imports from skills.sh; team publishing remains outside this scope. This is a target specification, not a shipped release; the application package currently declares `0.1.0` and the Paper file title remains `0.0.4`. The [0.0.7 agent compatibility update](docs/product/Skillet-0.0.7-agent-compatibility.md) documents implemented support for Codex, Claude Code, Pi, OpenCode, and Cursor, with a separate versioned Paper page.

The [0.0.8 Paper component revision](docs/product/Skillet-0.0.8-paper-components.md) aligns all five invocation designs with the shared yellow library. The [0.0.9 implementation](docs/product/Skillet-0.0.9-app-design.md) brings the shared yellow theme, compact dialogs, clickable cards, and invocation forms into the running application.

Agent skills are folders containing a `SKILL.md` file. Claude Code, Codex, Cursor, Gemini CLI, Copilot and dozens of others all load them, each from its own directories, each with its own rules about when a skill is active. After a few months you end up with copies scattered across `~/.claude/skills`, `~/.codex/skills`, a dozen repositories, and every git worktree of each. Nothing tells you what you have, which copies have drifted apart, or which agent can actually see any given one.

Skillet answers three questions in one screen:

1. **What skills exist**, everywhere on this machine.
2. **Where each one lives**, including every duplicate copy and symlink.
3. **Which agent can see it, with the known conditions and unresolved settings.**

Then it lets you edit, rename, delete, move, link, copy and retrigger them, with a preview before every write and an undo after it.

---

## Contents

- [Why this exists](#why-this-exists)
- [Install and run](#install-and-run)
- [A tour of the app](#a-tour-of-the-app)
- [The visibility matrix](#the-visibility-matrix)
- [What Skillet scans](#what-skillet-scans)
- [The hub, and what "adopt" does](#the-hub-and-what-adopt-does)
- [Operations, previews and undo](#operations-previews-and-undo)
- [Safety model](#safety-model)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [HTTP API](#http-api)
- [Adding an agent](#adding-an-agent)
- [Known limitations](#known-limitations)
- [Development](#development)
- [Prior art](#prior-art)

---

## Why this exists

Your chosen skills can be available in different places and under different conditions. A project skill depends on the repository context. Claude Code skills can have path-based activation and settings overrides. Plugin skills depend on their plugin being enabled. Skillet brings those details into one personal view; its visibility rules must reflect the behavior supported by each agent.

Skillet reads all of that and prints it as a condition beside each agent, so the answer to "why isn't my skill firing" stops being guesswork.

It also found two real problems on the first machine it ran against: a skill whose unquoted description contained a colon, so its YAML frontmatter failed to parse and two agents had been silently ignoring it for weeks, and two skills stored in a directory no installed agent reads.

---

## Install and run

Requires [Bun](https://bun.sh) 1.3 or newer. Nothing else. No database, no Docker, no build step to run it.

```bash
git clone <your-repo-url> skillet
cd skillet
bun install
bun run dev
```

Then open **http://localhost:5180**. Both servers bind to your local loopback interface.

| Script | What it does |
|---|---|
| `bun run dev` | Starts the API on 5181 and the app on 5180 together |
| `bun run dev:server` | API only |
| `bun run dev:web` | App only, expects the API to be up |
| `bun run build` | Production build of the web app into `apps/web/dist` |
| `bun run start` | Runs the API without file watching |
| `bun run typecheck` | Type-checks both workspace applications |
| `bun run test:unit` | Runs the unit test suite |
| `bun run test:browser` | Builds and runs desktop/mobile browser checks |
| `bun run deadcode` | Finds unused files, exports, dependencies, and types |
| `bun run quality` | Runs lint, type-checks, dead-code analysis, unit tests and the production build |

The first scan takes one to three seconds depending on how many repositories you have. Skillet writes nothing until you ask it to.

### First run

Out of the box Skillet scans your global agent directories and your Claude Code plugins, so you will see your global and plugin skills immediately. It scans **no project directories** until you tell it where to look, because walking the wrong tree is slow and pointless.

Open **Settings** and add your project roots, one per line:

```
~/code
~/work/monorepo
```

Save, and it rescans immediately. Project skills, git worktrees and repository labels appear from then on.

---

## A tour of the app

**Skills list.** Click a card to open its starter prompt; use its corner share icon to manage global availability and agent transfers. Cards show a short description and reusable agent/scope chips. Filter by scope, by repository, or by agent from the sidebar. Search by name or description. Tick "problems only" to see just the skills that are invalid, shadowed, or have copies that have drifted apart. Press `⌘K` anywhere to jump to a skill by name.

**Skill detail** has five tabs.

- **Content** edits the frontmatter through a form and the body in a Markdown editor, validating against the Agent Skills spec on save. It also renames and trashes.
- **Visibility** is the matrix described below.
- **Instances** lists every copy of the skill on disk with its content hash, its git status, and which agents read it. Pick any two copies and see a unified diff. Move the skill to the hub or into a repository, or copy it.
- **Triggers** offers separate invocation controls for Codex, Claude Code, Pi, OpenCode, and Cursor. See the [support matrix and limits](docs/product/Skillet-0.0.7-agent-compatibility.md).
- **History** shows every change Skillet has made to this skill, with an undo.

**Agents** lists all 77 agents Skillet knows, which are installed here, and the exact directories each one reads.

**Adopt into hub** is the migration flow. **Trash** restores or permanently purges. **Settings** controls the scan.

---

## The visibility matrix

This is the point of the tool. For a given skill, each installed agent gets one row and one of these states:

| State | Meaning |
|---|---|
| `auto` | The agent loads it on its own when the task matches |
| `user-only` | Only you can invoke it; the model cannot |
| `model-only` | Only the model can invoke it; hidden from your slash menu |
| `name-only` | The agent sees the name but not the description |
| `off` | Disabled or denied by the settings Skillet can resolve |
| `ask` | OpenCode requires permission before loading |
| `unknown` | Invocation policy is unverified or runtime settings cannot be resolved |
| `not-linked` | This agent has no copy of this skill |
| `n-a` | The agent is not installed on this machine |

Beside the state, Skillet lists the **conditions** that gate it. These are the part you cannot get from any directory listing:

- `cwd inside <repository>` for a project skill, with the branch shown when it lives in a worktree
- `editing under <subdirectory>/` for a skill nested in a monorepo package
- `editing <glob>` when the skill declares a `paths` field
- `plugin <name> enabled` for a plugin skill
- `via compat dir <path>` when an agent is reading the skill through another tool's directory, for example Cursor reading `.claude/skills`
- `skillOverrides: <value>` when a Claude Code settings file has changed the state
- `disabled in ~/.codex/config.toml`
- `symlink to <target>` when this copy is a link
- `shadowed by a global skill of the same name`

Where a row says `not-linked`, there is a **Link** button that puts the skill into that agent's directory for you.

---

## What Skillet scans

| Scope | Locations |
|---|---|
| **Global** | Every installed agent's global skills directory, its legacy compatibility directories, and the Skillet hub |
| **Project** | Every agent skills directory inside each configured project root. Git repositories, plain directories, and every git worktree, each labelled by its branch |
| **Plugin** | Claude Code plugin skills, from enabled plugins only, read-only, with a count of stale cached versions |

Agent directories come from a registry of 77 agents, each with a global path, a project path, legacy paths, and a detection rule. An agent counts as installed when its configuration directory exists.

Skills that appear in more than one place are grouped into a single logical skill with several **instances**. If two instances differ by content hash, the skill is flagged **diverged** and you can diff them.

The scanner follows symlinked directories (with a cycle guard), so a skill reached only through a symlink is still found. It skips `node_modules`, `.git`, `dist`, `build` and a few others by default, configurable in Settings.

---

## The hub, and what "adopt" does

By default Skillet only reads. If you want one canonical copy of each global skill instead of near-identical duplicates in every agent's directory, adopt them into the hub.

`~/.skillet/hub/<skill>/` becomes the single source of truth, and each agent's global directory gets a symlink pointing at it. Editing the skill once changes it for every agent.

The **Adopt** page groups your existing global copies by content hash and shows you:

- how many groups are byte-identical, which adopt with no decision needed
- how many **conflict**, meaning the copies differ, with both paths and hashes side by side so you choose which becomes the source of truth
- how many are already in the hub

Nothing is deleted. Losing copies are moved to `~/.skillet/hub/.adopt-backup/`, and the whole operation is one undoable journal entry.

**Project skills are never adopted.** They belong to their repository and stay there. Inside a repository, Skillet links between agent directories using **relative** symlinks, so the link still resolves for a teammate who clones the repo. Links that cross a repository boundary stay absolute, because a relative one would be meaningless on another machine.

---

## Operations, previews and undo

Every operation runs in two phases. Skillet first computes the exact list of filesystem steps and shows it to you:

```
1. mkdir    ~/.codex/skills
2. symlink  ~/.skillet/hub/pr-reviewer  to  ~/.codex/skills/pr-reviewer
```

Nothing has touched the disk at that point. You confirm, and only then does it apply.

| Operation | What it does |
|---|---|
| **Edit** | Rewrites `SKILL.md`, validating name format, name-matches-directory, and description length |
| **Rename** | Renames the directory, updates the `name` field, and relinks every symlink that pointed at it |
| **Trash** | Moves the skill to `~/.skillet/trash/<timestamp>/` with a manifest, removing its symlinks |
| **Restore** | Puts a trashed skill back where it came from, symlinks and all |
| **Link** | Creates a symlink in another agent's directory |
| **Unlink** | Removes a symlink, never a real directory |
| **Copy** | Either a link, or a genuinely independent copy you can then diff |
| **Move** | Between a repository and the hub, or between repositories, relinking as it goes |
| **Trigger** | Writes supported per-agent frontmatter, Claude Code overrides, Codex policy/config, or OpenCode skill permissions |

Every applied operation appends an entry to `~/.skillet/journal.jsonl` containing both the steps taken and their inverses. **Undo** replays the inverses of the most recent entry. The History tab shows what happened to a given skill.

---

## Safety model

Skillet writes inside your home directory, so it is deliberately careful.

- **Previews.** Every mutation can be run as `dryRun` and the UI always does that first.
- **Transactional applies.** If a multi-step operation fails halfway, the completed steps are rolled back before the error is returned, and the error says whether the rollback was clean.
- **Write sandbox.** Writes are refused outside the hub, the trash, the resolved agent directories, and your configured project roots.
- **Symlinks are respected.** Unlink refuses to run on a real directory. Delete never recurses through a symlink into unrelated content. If the only copy of a skill inside a scanned directory is a link to content living outside all of them, mutations are refused with an explanation rather than quietly moving the link.
- **Plugin skills are read-only**, since they belong to an installed package.
- **Git is read-only.** Skillet shows tracked, modified and untracked badges. It never stages, commits, or checks anything out.
- **Local writes require a header.** The API rejects any write that does not carry an `x-skillet-client` header, and any write arriving from a foreign `Origin`. Without this, a page open in another browser tab could POST to `localhost:5181` and move files in your home directory, because CORS restricts who may *read* a response, not who may *send* a request.

Skillet has no authentication beyond that, and is intended to run on your own machine only. Do not expose port 5181 to a network.

---

## Configuration

Settings live in `~/.skillet/config.json` and are editable from the Settings page.

```json
{
  "hubPath": "~/.skillet/hub",
  "projectRoots": [],
  "maxDepth": 6,
  "ignoreDirs": ["node_modules", ".git", "dist", "build", "coverage", ".next", ".turbo", ".venv", "chrome-profile", ".cache"],
  "showAllAgents": false,
  "customAgents": []
}
```

| Key | Meaning |
|---|---|
| `hubPath` | Where adopted skills live |
| `projectRoots` | Directories to scan for project skills. Empty by default |
| `maxDepth` | How many directories deep to walk from each root |
| `ignoreDirs` | Directory names skipped entirely |
| `showAllAgents` | Include agents that are not installed in the visibility matrix |
| `customAgents` | Extra agents, see below |

Other state Skillet owns: `~/.skillet/trash/` and `~/.skillet/journal.jsonl`.

---

## Architecture

A Bun workspace with two packages.

```
apps/
├── server/                Bun + Hono API on port 5181
│   └── src/
│       ├── registry/      agent paths, environment expansion, install detection
│       ├── scan/          filesystem, git, plugin, override and watcher logic
│       ├── visibility/    per-agent states and conditions
│       ├── hub/           operations, preflight guards, rollback and journal
│       └── routes/        HTTP resources
└── web/                   Vite + React 19 SPA on port 5180
    └── src/
        ├── api/           typed client and server-sent-events subscriber
        ├── components/    shared interface components
        └── pages/         skills, detail, agents, adopt, trash and settings
quality-tests/             unit and desktop/mobile browser verification
```

Design decisions worth knowing:

- **The filesystem is the only source of truth.** There is no database. The index is held in memory and rebuilt by a scan.
- **Mutations are data.** Every operation produces a list of typed steps, which is what makes previews, transactional rollback and undo all fall out of one mechanism.
- **Live updates.** A watcher notices changes made outside the app and pushes an event over server-sent events, so the open page reflects an edit you made in your editor within a second or two.
- **Every source file stays under 500 lines.**

---

## HTTP API

Read endpoints are plain `GET`. Write endpoints require the `x-skillet-client: skillet-web` header and accept `"dryRun": true` to preview.

```
GET    /api/health
GET    /api/index                     the whole index: agents, repos, skills, cells
POST   /api/rescan
GET    /api/events                    server-sent events, pushes on change
GET    /api/agents
PUT    /api/agents/custom
GET    /api/skills/:id
GET    /api/skills/:id/diff?a=&b=
PUT    /api/skills/:id/content
POST   /api/skills/:id/rename
POST   /api/skills/:id/link
POST   /api/skills/:id/unlink
POST   /api/skills/:id/copy
POST   /api/skills/:id/move
POST   /api/skills/:id/trash
POST   /api/skills/:id/trigger
GET    /api/trash
POST   /api/trash/:entryId/restore
DELETE /api/trash/:entryId
GET    /api/journal
POST   /api/journal/undo
POST   /api/adopt/plan
POST   /api/adopt/apply
GET    /api/config
PUT    /api/config
```

A skill id is `global:<name>`, `project:<repo path>:<name>`, or `plugin:<plugin>:<name>`, URL-encoded. An instance id is its absolute path, which means a stale id from an out-of-date page fails with a 404 rather than touching the wrong file.

Errors return `{ code, message, method, service }`. Notable codes: `VALIDATION`, `DEST_EXISTS` (409), `NOT_A_SYMLINK`, `PLUGIN_READONLY`, `NO_REAL_CANONICAL`, `OUT_OF_ROOTS`, `APPLY_FAILED`, `FORBIDDEN_ORIGIN`, `MISSING_CLIENT_HEADER`.

Example:

```bash
curl -s -X POST localhost:5181/api/skills/global%3Apr-reviewer/link \
  -H 'content-type: application/json' \
  -H 'x-skillet-client: skillet-web' \
  -d '{"target":{"agentId":"codex","scope":"global","repoId":""},"dryRun":true}'
```

---

## Adding an agent

The registry lives in `apps/server/src/registry/agents.data.ts`, one line per agent:

```ts
['claude-code', 'Claude Code', '$CLAUDE_CONFIG_DIR/skills', '.claude/skills', '$CLAUDE_CONFIG_DIR', 'claude', '', '']
```

The fields are id, display name, global directory, project directory, detection paths, override source, legacy global directories, legacy project directories. Multiple values inside a field are separated by `|`. Paths may use `$HOME`, `$XDG_CONFIG_HOME`, `$CLAUDE_CONFIG_DIR`, `$CODEX_HOME` and similar, which are expanded with sensible defaults.

To add an agent without editing the source, put it in `customAgents` in `~/.skillet/config.json` using the same field names as `AgentDefinition`.

---

## Known limitations

- **Agent compatibility has boundaries.** The five-agent invocation editor supports standard skill folders and documented settings. Copying preserves resources but does not translate agent-specific instructions or dependencies. Pi custom discovery, Cursor remote availability, and OpenCode V2 permissions are not fully supported. See the [0.0.7 compatibility guide](docs/product/Skillet-0.0.7-agent-compatibility.md) for tested behavior and runtime limits.

- **New directories need a rescan.** The watcher watches the skill directories it has already discovered, not entire project roots, because watching thousands of directories starves the event loop. Create a brand-new `.claude/skills` folder and press **Rescan** to see it.
- **Undo leaves empty directories.** Undoing a link removes the symlink but not a directory that was created to hold it.
- **`/api/index` is large**, a megabyte or two, because it embeds every skill body. Fine over localhost.
- **The skill detail route is lazy-loaded**, including its editor. Measure the current production output before relying on older bundle-size figures.
- **Moving files across filesystems fails.** The move step uses `rename`, which cannot cross devices.
- **Single user, no auth.** Localhost only, by design.

---

## Development

```bash
bun install
bun run typecheck
bun run test:unit
bun run build
bun run test:browser
```

The unit suite covers deterministic parsing behavior. Browser checks exercise read-only flows against a real local scan on desktop and mobile. Filesystem mutation behavior is still verified manually against an isolated fixture directory. The design document and the full implementation plan, including the original verification procedure, are in `docs/superpowers/`.

House style, enforced by review rather than a linter: no code comments, no ternary assignment outside JSX rendering, no `.filter().map()` chains, no `await` inside a loop except in the ordered filesystem transaction and the two directory walkers, `async` functions wrap their body in a try/catch that rethrows a `SkilletError` carrying message, method, service and cause, no explicit `any`, and every file under 500 lines.

---

## Prior art

Worth knowing about, and genuinely useful for what they do:

- [vercel-labs/skills](https://github.com/vercel-labs/skills), the `npx skills` CLI. Installs skills from GitHub into any of 76 agents. Skillet's agent registry is transcribed from its source.
- [jiweiyeah/Skills-Manager](https://github.com/jiweiyeah/Skills-Manager), a Tauri desktop app that syncs a central library into 32 tools by symlink.
- [abubakarsiddik31/skill-manager](https://github.com/abubakarsiddik31/skill-manager), a desktop dashboard that tracks project folders and labels which tool sees a shared skill.
- The [Agent Skills specification](https://agentskills.io/specification), which Skillet validates against.

Skillet's difference is the visibility matrix with conditions, git worktree awareness, project scopes across every agent directory, per-agent trigger editing, plugin skills, previews with transactional rollback, and undo.
