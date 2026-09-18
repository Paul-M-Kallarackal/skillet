# Architecture and code map

Skillet is a Bun workspace. `apps/server` contains the Hono API; `apps/web` contains the React client. Files on disk are the source of truth. Scanning creates an in-memory `SkilletIndex` returned by `GET /api/index`.

## Discovery and skill identity

1. `apps/server/src/index.ts` registers routes, calls `scanAll()`, and starts the watcher.
2. `registry/agents.ts` expands the paths in `agents.data.ts` and detects agents by the existence of configured paths.
3. `scan/scanner.ts` discovers global directories, configured project roots, repositories/worktrees, and enabled Claude Code plugins.
4. `scan/walk.ts` parses `SKILL.md` and creates a `SkillInstance` for each installation.
5. `scan/fingerprint.ts` hashes the complete folder; `scan/index-builder.ts` groups equal names and fingerprints.
6. `visibility/visibility.ts` computes access and conditions for each agent/installation pair.

Server paths below are relative to `apps/server/src/`.

A **skill instance** is a physical location, with its own scope, repository, readers, symlink target, and plugin ownership. A **skill** is one content version with one or more instances. Identical copies across scopes and repositories count as one skill.

Fingerprints use SHA-256 over relative directory/file paths, file bytes, and executable permission bits. Symlinked resources are read through their targets. `.DS_Store` and root `.skillet-source.json` import provenance are excluded. Cyclic, unreadable, or unsupported resources produce no fingerprint and are never merged on that basis. Different versions of the same name remain separate entries marked `diverged`.

The representative is selected deterministically: hub first, then editable global directories, editable project directories, other non-plugin instances, and plugins. Its ID is `<scope>:<parent path>:<name>`. Clients obtain IDs from the index and URL-encode them; IDs may change when the representative moves or grouping changes. Top-level scope/repository fields describe the representative. Filters and permissions use the individual instances.

Grouping is observational. It does not synchronize copies. Editing a file or resource can split a group on rescan; restoring identical content merges it again.

## Operations

Most skill mutations build an array of `FsStep` objects. `dryRun: true` returns that plan. Applying it executes filesystem operations through `hub/steps.ts`; failures attempt rollback of completed steps. Successful operations append explicit inverse steps to the journal.

| Module | Responsibility |
|---|---|
| `hub/content.ts` | Validate and save skill metadata/body; rename a source and its links |
| `hub/linking.ts` | Copy, link, unlink, move, and install into distinct global directories |
| `hub/trigger.ts` | Change supported invocation metadata and agent settings |
| `hub/agent-settings.ts` | Read/write JSONC, TOML, and YAML policy files |
| `hub/adopt.ts` | Plan global consolidation, back up alternate copies, and link originals to the hub |
| `hub/trash.ts` | Remove a chosen installation, record its original location, restore, and purge |
| `hub/journal.ts` | Append operation records and apply the latest inverse |
| `hub/preflight.ts` | Check destination conflicts, allowed roots, plugin ownership, and link expectations |

Copying preserves a complete independent folder. Linking creates another path to the same files. Links within one repository are relative in the normal link/move flow. Moving or renaming a representative updates links targeting that source, leaving links to other identical copies alone. Trash can target an individual instance; plugin instances remain read-only.

Adoption operates on global instances only, including differing versions under the same name. It creates unique backup locations and an undo plan. Undo itself becomes a journal entry, so undoing again reverses that undo; this is not a multi-level history cursor. Permanent purge has no inverse.

## Imports

`catalog/catalog.ts` searches skills.sh and fetches public GitHub sources. A preview resolves one commit and stages the selected skill folder in memory. Installation accepts the preview token and writes those exact files into a new hub directory with provenance metadata. It does not run downloaded scripts or automatically install into agent directories.

Limits: 200 files, 10 MB total, a 45-second preview deadline, and at most three staged previews retained for ten minutes. Unsupported links, submodules, unsafe paths, and truncated source trees are rejected. Existing destinations are preserved. Restarting the server invalidates previews.

## Updates and API

`scan/watcher.ts` watches known skill locations, resolved skill-link targets, and supported agent settings. Changes are debounced for 400 ms before rescanning. `routes/events-route.ts` sends server-sent events; the client fetches the new index. New project discovery locations can require a manual rescan. Configuration/project changes rebuild watch targets.

| Routes | Operations |
|---|---|
| `/api/index`, `/api/rescan`, `/api/events` | Inventory, rescan, live updates |
| `/api/skills/:id` | Read a skill and its availability |
| `/api/skills/:id/content`, `/rename`, `/trash` | Content and lifecycle |
| `/api/skills/:id/link`, `/unlink`, `/copy`, `/move` | Transfers |
| `/api/skills/:id/install-all`, `/remove-installation` | Installation management |
| `/api/skills/:id/trigger`, `/invocation` | Invocation policies |
| `/api/skills/:id/diff` | Compare indexed skill documents |
| `/api/adopt/plan`, `/api/adopt/apply` | Global consolidation |
| `/api/trash`, `/api/trash/:entryId/restore` | Trash listing and restoration; DELETE an entry to purge |
| `/api/journal`, `/api/journal/undo` | Operation history and latest undo |
| `/api/config`, `/api/agents`, `/api/agents/custom`, `/api/projects` | Configuration and discovery |
| `/api/catalog/search`, `/preview`, `/install` | Search and import |

Route implementations define HTTP methods and payloads. `apps/web/src/api/client.ts` contains the browser's requests. Mutation requests require the local client header and pass the origin guard in `security.ts`. Git discovery/status commands are read-only.

## Verification

`quality-tests/unit` covers parsing, catalog import, agent policies, filesystem transfers, content identity, consolidation, and undo with temporary directories. `quality-tests/browser` covers desktop/mobile inventory, filters, editing, installation requests, sharing, catalog flows, accessibility, and layout. Browser writes use mocked APIs.
