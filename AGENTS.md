# Skillet repository guidance

Skillet is a Bun workspace containing the local Hono API and React interface.

## Product and architecture

Read `README.md` for the product boundary, `docs/architecture.md` for the code map, and `docs/agent-compatibility.md` before changing agent behavior.

- Files on disk are the source of truth. Discovery builds an in-memory index; there is no application database.
- A skill is one name and complete content version. An instance is an installation with its own location, scope, repository, agent access, and ownership.
- Group identical names and complete folder fingerprints across global, project, and plugin locations. Keep different versions separate. Missing or unreadable fingerprints are not evidence of equality.
- Fingerprints include supporting resources and executable bits. Keep the exclusions for `.DS_Store` and root import provenance explicit; do not substitute a `SKILL.md`-only comparison.
- Grouping must not move or synchronize files. Filters and permissions must consider instances, not just the representative. Obtain skill IDs from the index; representative changes can change IDs.
- Availability is a local estimate from paths and supported policies. Do not present it as proof that an agent loaded or executed a skill.

## Workspace layout

- Keep deployable applications under `apps/*`.
- Keep shared root configuration and quality tooling at the workspace root.
- Keep discovery and identity in `apps/server/src/scan`, policy evaluation in `visibility` and the relevant adapters, filesystem operations in `hub`, and remote imports in `catalog`.
- Keep HTTP handlers in `apps/server/src/routes` and browser requests in `apps/web/src/api`.
- Keep `apps/web/src/app/App.tsx` as the composition and routing root.
- Put reusable interface code in `apps/web/src/components` and route-level views in `apps/web/src/pages`.
- Keep the bundled Strawn font and its license under `apps/web/src/assets/fonts`.
- Use readable system sans-serif typography throughout the application. Reserve Strawn for website branding and display headings; never use it as the default application or body font.

## Filesystem operations

- Resolve the selected installation and actual link targets before mutating files. Identical content does not imply shared storage or permission to change every copy.
- Preserve plugin ownership: plugin installations are read-only. Copy to an editable location before changing plugin content.
- Preserve occupied destinations and allowed-root checks. Renames, moves, and trash must update only links that target the selected source.
- Keep global hub adoption separate from project and plugin installations. Preserve backups and the inverse operation order.
- Use the existing filesystem step and preflight machinery for operations that support plans, dry runs, rollback, and journaling. Do not describe irreversible purge as undoable or rollback as guaranteed.
- Catalog installation must use the reviewed, commit-pinned preview and retain path/resource validation. Importing must not execute downloaded scripts or silently install them into agents.
- Preserve local-origin checks and the mutation client header. Run mutating tests against temporary fixtures or fully mocked write endpoints, never personal agent files or settings.

## Paper workflow

Before application implementation or review, read `/home/pmk/.codex/skills/paper-workflow/SKILL.md` and consult the matching design through Paper MCP. Skillet's current context is [Paper Current](https://app.paper.design/file/01M2AKV284AA8XMEQBNBRZV0CQ/A-0).

Create or update affected UI screens in Paper before implementing visual changes, then verify the repository result. For nonvisual work, consult the relevant context without inventing screen changes. Keep separate applications in separate Paper files. If Paper is unavailable, help restore access and report the exact blocker; do not silently bypass the workflow. A later explicit user instruction may override this preference for a task.

## Verification

Use Bun 1.3.14+ and Node.js 24 for the current development toolchain. Bun installs dependencies, runs the API/scripts, and runs unit tests.

| Check | Command | Responsibility |
|---|---|---|
| TypeScript | `bun run typecheck` | Type compatibility in both applications |
| Knip | `bun run deadcode` | Unused files, exports, and dependencies |
| Bun test | `bun run test:unit` | Isolated unit and filesystem tests in `quality-tests/unit` |
| Playwright | `bun run test:browser` | Browser behavior in `quality-tests/browser`; Chromium desktop/mobile emulation |
| Vite | `bun run build` | Production web build |

Run focused checks while iterating. Add meaningful regression coverage for identity, permissions, filesystem mutations, and other behavioral fixes. Do not create tests that only mirror implementation or add behavioral tests for documentation-only edits.

Run `bun run quality` and `bun run test:browser` before handing off broad frontend or workspace changes. `quality` includes type checks, Knip, unit tests, and build; browser tests are separate. Playwright builds the web app and starts its servers. Use `SKILLET_TEST_REUSE_SERVER=1` only when intentionally testing compatible servers already running locally. Browser mutation requests must be mocked unless the server is explicitly isolated to disposable fixture paths.

Use `bun:test` for unit tests and `bun run test:unit` to run them with `--isolate`. Keep the test discovery root in `bunfig.toml` limited to `quality-tests/unit`. Register module mocks before dynamically importing mutation services; Bun does not hoist them. Restore spies and system time after each test, and clean up temporary fixture directories. `mock.restore()` does not undo module mocks, so preserve file isolation. Do not enable concurrent tests within suites that share mutable fixture state.

ESLint and Vitest have been removed. Bun does not provide equivalent lint rules: check React Hooks usage, source patterns, and accessibility during review, and retain browser accessibility checks. Do not claim type checks or passing tests provide full lint coverage.

For documentation-only changes, check relative links, render changed Mermaid diagrams, and run `git diff --check`. Report checks actually performed and any limitations.

## Documentation and cleanup

- Keep `README.md` focused on the problem, behavior, setup, tooling, and ecosystem references. Keep implementation details in the two current documents under `docs/`.
- Update documentation when behavior changes. Distinguish implemented functionality from estimates or unsupported policies, and verify external comparisons against primary project documentation.
- Use short Mermaid diagrams with readable labels; avoid generated images for architecture that can remain editable text.
- Do not restore historical briefs, generated handoff bundles, screenshots, or exports to `docs/`; they remain in Git history. Preserve required asset licenses and attribution.
- Confirm references, dynamic use, and public API responsibilities before removing apparently unused code. An endpoint is not dead merely because the current browser client does not call it.
