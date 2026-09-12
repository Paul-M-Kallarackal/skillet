# Find and add skills

Skillet now connects to Vercel's skills.sh directory from **Tools → Find skills**. Search by a task or paste a complete `https://skills.sh/owner/repository/skill` link. Choose **Review**, inspect the instructions and file list, then **Add to library**. The skill appears in the configured global hub; use the card’s eye control to make it available to an agent.

This explicitly extends the earlier personal-library scope with selected catalog imports. It does not add publishing, rankings, accounts, or automatic synchronization.

## Implementation

- `GET /api/catalog/search?q=…` uses the same public search endpoint as the [official Vercel skills CLI](https://github.com/vercel-labs/skills/blob/main/src/find.ts). Search returns up to 20 results; direct skill links bypass search.
- `POST /api/catalog/preview` accepts `{source, slug}`. Public GitHub sources are resolved at one commit, then the complete skill folder is downloaded in memory. Frontmatter names identify skills even when their folder names differ. Supporting files, binary content, and executable permissions are preserved. No repository scripts run.
- `POST /api/catalog/install` accepts only the returned preview token. The exact reviewed files are written to a newly created hub directory. Existing directories and symlinks are refused. A source/revision record is stored in `.skillet-source.json`. Failure before journaling rolls back the new folder; successful imports are recorded for the operation journal.
- After installation the server rescans and returns the imported skill ID. The browser refreshes the index and provides **Open skill**.

## Bounds

Only public GitHub repositories are supported. GitHub's unauthenticated rate limits apply. The public catalog endpoint may change; there is no dependency on Vercel's authenticated v1 API or an account token. Skills are limited to 200 regular files and 10 MB, with a 45-second preview deadline. Symlinks, submodules, unsafe paths, truncated repository trees, and repositories with more than 100 skill definitions are rejected. Up to three previews are retained for ten minutes; restarting the server invalidates them. Existing local skills are never updated automatically.

## Design and verification

[Paper: Find skills search and review](https://app.paper.design/file/01M2AKV284AA8XMEQBNBRZV0CQ/9-0) extends the shared yellow system. Implementation uses the incumbent responsive app shell and native dialog, with source/file disclosures added to the review. Desktop and mobile captures are in `.impeccable/review/catalog-*.png`.

`bun run quality` passed: lint, both TypeScript projects, Knip, 59 tests, and production build. `SKILLET_TEST_REUSE_SERVER=1 bun run test:browser` passed all 38 desktop/mobile tests. Catalog tests cover review-before-write, complete-file preservation, source pinning, duplicate races, malformed references, unsupported links, expiry, rollback, undo, errors, focus restoration, and accessibility. The pre-existing large skill-editor bundle warning remains.

A live read-only preview of `vercel-labs/agent-skills/vercel-react-best-practices` returned 76 files at commit `063bee94c3f4df8453406c830b0a7df0f2860278`. No personal skills were installed during verification; filesystem tests use temporary directories and browser imports are mocked.

## Current skill and availability interface

Click a card or open a skill URL to see its full content in a wide modal. Markdown renders in a compact white-fade preview; a down/up chevron expands/collapses a bounded reader, and clicking or moving keyboard focus outside collapses it. Edit Markdown lazily loads the editor. Description has no counter; advanced settings, Allowed tools, starter prompts, History, and More actions are removed. Existing metadata is preserved on save. The trash icon sits beside persistent Save. Clicking the title renames on Enter/blur, with inline validation.

The shared Dialog has separate header/body/footer regions. Headers and footers are padded; only the body scrolls. Wide-modal styles target direct children so nested confirmations keep their own padding. ConfirmDialog shows plain installation/removal text with Cancel and Install or Remove access controls, without filesystem steps. PlanDialog uses the same footer for other operations. Paper's current Yellow master and shared-ui template match.

Visibility contains a scope selector, a repository picker for One project, and compact icon/name agent chips. Selected means a readable installation exists, independent of app detection; project availability also includes global installations. Click an unselected chip to confirm installation; click a selected chip to confirm removal of the matching installation. Symlinks are unlinked without modifying their source; real copies go to Trash and can be restored. Shared-folder confirmations name the other readers affected. Other compatibility folders may still provide access after one installation is removed.

A final Global chip with a globe confirms installation across every known agent's distinct resolved global skills directory. Existing destinations are preserved; shared paths are deduplicated; all new copies are preflighted and applied as one journaled operation with rollback. Agents with no resolvable global directory cannot receive a global installation. Grok Build uses GROK_HOME or its documented ~/.grok default and recognizes its compatibility skill directories. The Install for dropdown and Link to agent / Install copy / Move to folder buttons are removed.

Repository discovery searches configured roots, Desktop, and Projects to depth four. Selecting a discovered Git repository or entering an absolute Git repository path registers it and refreshes the index. All selects use the shared native Select: 44px minimum height, 14px text inset, 48px trailing text gutter, and chevron inset 16px. The project picker has its own full-width row; long values truncate without widening the dialog.

Card access indicators show Codex, Claude Code, Cursor first, up to three logos, then +N. When every known agent with a resolved global directory has access, only a globe is shown. Codex uses the black ChatGPT knot; Zed has its official mark. Sidebar agent names remain visible with green/red detection dots inset 16px. Installed skill access and app detection are separate states.

Identical global/project skills collapse to one card in combined views using matching content hashes; project and agent filters retain their matching entries. Different project versions remain visible. The sidebar has one All skills inventory; Shared hub, Components, and Plugins categories are removed. Cards have no status tags or Needs attention control.

Content opens directly without tabs. The card’s eye opens visibility separately. A compact Always / Only when I ask toggle inside content saves usage immediately across installed copies. Always permits automatic use when relevant; it does not force execution on every message. Agent support varies. Installed locations and copy comparisons are removed. The generated yellow/graphite skillet image is the sole visual brand in the app and README. Bundled icons cover 41 agents with brand/provider marks; Universal uses a globe and other agents use a neutral bot.

Verification: lint, both TypeScript projects, Knip, 59 unit tests, and production build passed. All 38 desktop/mobile browser tests passed. Mutations use temporary unit fixtures or mocked browser requests; the live registry rescan was read-only. The editor's existing bundle-size warning remains confined to its lazy chunk. Confirm captures: test-results/confirm-install-desktop.png and confirm-install-mobile.png.

The card Share icon copies a portable message containing the description and full instructions for Slack or another messenger. The recipient pastes it into their agent. Companion files are named as missing when applicable; this is conversation guidance, not an installation. Clipboard failure opens selectable text. The text-only SegmentedControl is shared with Current Yellow components; it stays interactive during saves and serializes the latest requested choice. Disabled options use grey and a skip icon.
