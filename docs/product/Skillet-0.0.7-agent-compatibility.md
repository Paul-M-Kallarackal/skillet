# Skillet 0.0.7 — Agent compatibility

Updated September 12, 2026. This is an implementation and design revision, not a published package release. The application package remains `0.1.0`. The personal-library scope in [0.0.6](Skillet-0.0.6.md) still applies.

Skillet now has separate invocation controls for **Codex, Claude Code, Pi, OpenCode, and Cursor**, plus tested folder copying and linking for all five. A shared `SKILL.md` does not imply shared settings semantics.

## What works

| Agent | Invocation controls in Skillet | Where changes are saved |
|---|---|---|
| Codex | Automatic invocation on/off; skill enabled/disabled | `agents/openai.yaml` policy and path-based `skills.config` entries in `$CODEX_HOME/config.toml` |
| Claude Code | Explicit-only, slash-menu visibility, matching paths, availability override | Skill frontmatter; global `settings.json` or project `.claude/settings.local.json` |
| Pi | Explicit-only | `disable-model-invocation` in skill frontmatter |
| OpenCode | Allow, ask before loading, deny; global/project scope | `permission.skill` in `opencode.json` or `opencode.jsonc` |
| Cursor | Explicit-only; matching paths | Skill frontmatter |

Controls are available only when the selected agent can read an instance of the skill. Plugin-managed skills remain read-only. Unsupported invocation policies for other registry agents are reported as **unknown** instead of assuming Claude Code behavior.

The visibility matrix now distinguishes **ask** and **unknown**, reads Codex's path-based disable entries and automatic-invocation policy, and evaluates standard OpenCode skill permissions. Config changes are included in file watching; newly created skill directories may still require Rescan.

Claude user overrides are saved to `$CLAUDE_CONFIG_DIR/settings.json`; project-local overrides take precedence over user defaults. External OpenCode config environment variables cause an unknown visibility state even when the standard config files are absent.

## Standard destinations

These are Skillet's normal copy/link targets. Environment-variable overrides are expanded by the agent registry.

| Agent | Global | Project |
|---|---|---|
| Codex | `$CODEX_HOME/skills` (default `~/.codex/skills`) | `.agents/skills` |
| Claude Code | `$CLAUDE_CONFIG_DIR/skills` (default `~/.claude/skills`) | `.claude/skills` |
| Pi | `~/.pi/agent/skills` | `.pi/skills` |
| OpenCode | `$XDG_CONFIG_HOME/opencode/skills` (default `~/.config/opencode/skills`) | `.opencode/skills` |
| Cursor | `~/.cursor/skills` | `.agents/skills` (also scans `.cursor/skills`) |

The registry also scans compatibility directories, including Pi's shared `.agents/skills` locations and OpenCode's shared/Claude directories. Copying OpenCode skills now targets its own `.opencode/skills` directory.

## Use it

1. Open a skill and use **Copy** or **Link** to make it available to another installed agent. Choose global scope for personal use across projects or a project destination for repository-specific use.
2. Open **Triggers** and select that agent. Set its supported invocation behavior.
3. Review **Preview changes**, then confirm. History provides undo.
4. Restart Codex after changing enabled status; use `/reload` in Pi after edits. Pi project skills also require trust.

A copy includes the entire skill folder and supporting resources. A link shares one folder, so edits affect every agent using it. Use independent copies when agents need different instructions or settings.

Copying preserves content; it does not translate agent-specific tool names, command syntax, scripts, dependencies, or vendor metadata. Review those when moving a skill between agents. Explicit invocation itself differs: for example, Codex uses `$skill` and Pi uses `/skill:name`.

## Boundaries

- This revision supports standard **folder-based skills and the settings above**. It does not prove every skill's instructions or executable resources work in every agent.
- Pi's loose Markdown skills, package-provided skills, custom CLI/settings paths, and all session flags are not fully modeled. Project trust and session configuration can change availability.
- Cursor support describes local skills. Cloud/remote agent availability and synchronization are managed in Cursor. Its legacy `globs` alias is not modeled as a matching-path condition.
- OpenCode V2 `permissions` editing is rejected. Profile overrides, custom config sources, and additional runtime settings can make availability unresolved; Skillet reports unknown when detected. The permission matcher handles exact names and `*` patterns, not every possible runtime pattern.
- Visibility is a filesystem/configuration estimate. Agent versions, sessions, working directories, trust, nested precedence, plugins, and custom discovery sources may change the final runtime result.
- The other registry agents retain directory discovery and transfer support. They have no verified invocation editor in this revision.
- ZIP skill export/import and the full yellow component-library redesign remain separate work from this compatibility update.

## Validation

`bun run quality` passes lint, type checking, dead-code analysis, 39 unit/integration tests, and the production build. `bun run test:browser -- --workers=4` passes 22 desktop/mobile browser checks.

The added coverage exercises five-agent folder copies and links, bundled resource preservation, preview without writes, apply/undo, agent-specific policy writes, malformed-config rejection, JSONC handling, visibility rules, field availability, keyboard focus restoration, accessibility, and layout overflow. Desktop and mobile screenshots were inspected.

Filesystem tests use temporary fixtures; browser mutations are mocked. These checks did not edit personal agent settings and did not launch all five agent executables. Live runtime verification inside each installed agent is still needed before claiming end-to-end compatibility.

## Design reference

[Paper: 0.0.7 · Agent compatibility](https://app.paper.design/file/01M2AKV284AA8XMEQBNBRZV0CQ/7-0) contains separate editable screens for all five agents. The Paper file title remains `Skillet — 0.0.4`; the new page is versioned `0.0.7`. The implementation adds the compact invocation form to the existing app shell; it does not apply the entire yellow theme.

## Official references

Checked September 12, 2026:

- [Codex skills](https://learn.chatgpt.com/docs/build-skills): skill discovery, invocation policy, and disabling skills.
- [Claude Code skills](https://code.claude.com/docs/en/skills): frontmatter and availability behavior.
- [Pi skills documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md): discovery, explicit invocation, trust, and reload.
- [OpenCode skills](https://opencode.ai/docs/skills/): directories and skill permissions.
- [OpenCode V2 permissions](https://opencode.ai/v2/docs/permissions): separate schema, outside the current editor's support.
- [Cursor skills](https://cursor.com/docs/skills): supported fields and local/remote availability.
