# Skillet 0.0.6 — your personal skill library

12 September 2026 · Product brief · Supersedes the broad roadmap in 0.0.5.

**Skillet gives you a clean, personal view of the skills you choose to use: what they do, which projects and agents can use them, when they are invoked, and how to share them.**

Your installed and selected skills are the starting point. Search means searching your library. Adding a skill means choosing a folder or importing something you deliberately selected. A public marketplace, community rankings and team publishing are outside this product's current scope.

## The four things it must do well

| Action | What you get |
| --- | --- |
| **Make global** | Promote a project skill into your top-level Global library and make it available to the agents you select. Preview the move and links; preserve existing project access where intended. |
| **Change invocation** | Edit what the skill should be used for and the supported agent-specific controls for automatic use, explicit invocation or disabling. See which linked copies will be affected. |
| **Share a skill** | Download the complete skill folder as a versioned ZIP, including its referenced scripts and resources. Send it through Slack or another file-sharing tool. The recipient chooses where to install it. |
| **Copy to another agent** | Choose an agent and global/project destination. Make an independent copy or keep one shared linked copy. Explain incompatible settings and missing tools before applying. |

Global storage and agent availability are separate: putting a skill in Skillet's hub must not imply that every agent automatically reads it. Similarly, copying files from Codex to Claude Code must not imply that vendor-specific settings have been converted correctly.

## The everyday view

Open Skillet → see your skills → filter by Global, project or agent → click a card to read/use the skill → edit invocation or use the corner share control.

Keep these existing capabilities available without crowding each card: duplicate detection, file differences, availability explanations, local history, undo, trash/restore and worktree awareness. Put detailed paths and filesystem plans inside the relevant detail or review step.

The main view should answer: “Which of my skills do I want here?” and “Will this agent be able to use it?”

## Your design decisions

- **Light only. Skillet uses soft yellow.** The shared library also offers pink, peach red, blue and purple through consistent semantic tokens.
- **Solid pastel buttons; subtle gradients in backgrounds only.** Apply this to page, card and modal surfaces.
- **Clean clickable cards.** No View button. A separate share icon sits at the top right. Reusable chips show agent, scope and category.
- **Compact controls.** Copy is an icon beside the prompt; close and share use familiar icons with accessible names and tooltips. Keep labels where the action needs explanation.
- **`+ New Folder`.** Adds an existing folder to Skillet's project scan.
- **Rounded, compact, aligned modals.** Brief copy, grouped fields, a clear main action, visible focus and useful error feedback.
- **Small inline statuses.** An icon and readable label, without wide outlined status strips.
- **Reusable components live in Components**, outside Skillet and HeartTap. Copy approved implementations into each product so each app remains self-contained.
- **Desktop first.** Mobile redesign is deferred. Preserve earlier design revisions using `0.0.x` labels.

## What the earlier suggestions meant

These were competitor features, not requirements you had requested. Their presence elsewhere does not make them gaps Skillet must fill.

| Term | Plain meaning | Fit for your Skillet |
| --- | --- | --- |
| Skill templates | A starter `SKILL.md` with name, description and instruction sections | Optional convenience if you want to create skills inside Skillet. Not required for managing your chosen collection. |
| Import scanning | Inspect an incoming skill's instructions and scripts for suspicious behavior | Keep basic validation and a readable file preview with import. A dedicated threat-analysis feature is a separate, optional decision. |
| Pinned projects | Folders you explicitly mark for quick access | Optional small convenience; not a reason to redesign the product. |
| Recent projects | Shortcuts to folders recently opened in Skillet | Optional. No need to inspect editor history or rank projects by inferred usage. |
| Private publishing | A hosted team registry with accounts, permissions and published packages | Out of scope. Sending someone a skill ZIP needs none of this. |
| Marketplace discovery | Browsing public skills, rankings or community collections | Out of scope for the main experience. You curate what enters your library. |

The earlier comparison found public installation/update commands in [Vercel Skills](https://github.com/vercel-labs/skills), creation and project shortcuts in [Skill Manager](https://github.com/abubakarsiddik31/skill-manager), and governed team publishing in [SkillHub](https://github.com/iflytek/skillhub). These tools solve adjacent problems. Skillet does not need their full feature sets.

Two ideas worth retaining for a personal collection are **where a skill came from** and **whether your saved copy has changed**. Skillet already has local instance comparison. A source link or optional update check for a skill you selected could extend that later, without introducing a public catalog or automatic installs.

## What is built, and what remains

| State | Included |
| --- | --- |
| Existing code | Local discovery, project/worktree scanning, card inventory, editor, visibility matrix, global move, local copy/link, history, undo and trash. |
| Designed or requested; still needs app integration | Yellow shared components, latest card/icon/modal refinements and clearer Global navigation. |
| New work | Portable ZIP export/import and reliable adaptation of agent-specific invocation settings. |
| Correctness work identified in 0.0.5 | Codex config reader/writer compatibility, agent-specific visibility rules, preserving malformed settings instead of overwriting them, and detecting changes to supporting-file contents. |

This is a product brief, not a new application release. The inspected application package is `0.1.0`; the [current Paper file is 0.0.4](https://app.paper.design/file/01M2AKV284AA8XMEQBNBRZV0CQ/6-0). The [0.0.5 audit](Skillet-0.0.5.md#readme-and-implementation-audit) retains the implementation evidence; its broader feature roadmap is superseded by this brief.

## Build order

1. Correct agent availability and invocation handling so the information is trustworthy.
2. Finish your approved personal-library interface using the shared yellow components.
3. Complete ZIP sharing/import and copy-to-agent flows, with file previews, conflict handling and recovery.

Success means you can find a skill you chose, make it available in the right place, control its invocation, and send a working copy to someone else. That is the product to finish before adding optional conveniences.
