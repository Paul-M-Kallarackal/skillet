# Skillet 0.0.8 — Shared components in Paper

The five agent invocation screens now consume the approved Shared UI templates and semantic tokens. This is a Paper design revision; application behavior and package version are unchanged.

- [Skillet 0.0.8](https://app.paper.design/file/01M2AKV284AA8XMEQBNBRZV0CQ/8-0): Codex, Claude Code, Pi, OpenCode, and Cursor.
- [Shared Components 0.0.6](https://app.paper.design/file/01M2AR2ECHY7WPRM851MXYYZFJ/6-0): the existing catalog plus select and checkbox states.

The screens use 27 component placements from the same saved templates as the library: primary buttons, neutral chips, fields, selects, and checkbox rows. Colors, typography, control radii, and spacing reference file-local `--ui-*` tokens copied from the canonical light lemon theme. Background gradients come from the canonical effects; buttons remain solid.

The library addition contains select default/focus/disabled states and checkbox default/checked/focus/disabled states. The prior catalog supplies field errors and button hover/loading/disabled states. The Claude Code screen now includes actual matching-path, override, and scope fields instead of placeholder text rows.

All five Paper screenshots and the new library board were inspected for spacing, typography, contrast, alignment, and clipping. JSX inspection confirmed shared token references on every screen. The canonical token validator passed 1,155/1,155 contrast pairs. No application tests were rerun for this design-only revision.

The shared library has 47 templates. Sources and usage are saved in `/home/pmk/Desktop/Components/patterns/shared-ui/`; `consumers/skillet-0.0.8.json` records source masters, template hashes, and destination nodes. Reviewed screenshots and the mapping are also saved in `/home/pmk/Desktop/Paper Designs/Skillet-0.0.8/`.

These are editable copies of common definitions, not automatically synchronized cross-file instances. Paper 0.0.7 is preserved. The Skillet file title remains 0.0.4; its latest invocation page is 0.0.8. The running app's visual adoption is still separate.
