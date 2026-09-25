# Agent compatibility

This describes behavior implemented by Skillet. Directory discovery does not prove that a running agent has loaded or will execute a skill. Agent sessions, trust, permissions, remote environments, and custom discovery sources can change availability.

Skillet ships with five built-in agents: **Claude Code, Codex, Cursor, OpenCode, and Pi**. The inventory, sidebar, access controls, and bulk installation all use this focused registry. Removing the other built-in entries does not delete their existing skill folders. Shared directories used by a supported agent are still scanned.

## Supported policy adapters

| Agent | Configuration read or written by Skillet |
|---|---|
| Codex | Enabled status in `$CODEX_HOME/config.toml`; implicit-invocation policy in the skill's `agents/openai.yaml` |
| Claude Code | Invocation/path metadata in `SKILL.md`; global `settings.json` and project `.claude/settings.local.json` overrides |
| Pi | Explicit-only invocation metadata in `SKILL.md` |
| Cursor | Explicit-only invocation and path metadata in `SKILL.md` |
| OpenCode | `permission.skill` entries in global or project `opencode.json` / `opencode.jsonc` |

The generic Always / Only when I ask operation updates invocation metadata across editable physical copies of the selected content version, plus applicable Codex policy. It does not enable every agent-specific setting or force execution on each message. Plugin copies remain read-only. More specific adapters are exposed through the trigger API.

Explicitly configured custom agents support directory discovery and transfers; their invocation policy is reported as `unknown` unless a matching policy adapter exists. Custom agents are an advanced local configuration option, not additional built-in integrations.

## Standard destinations

| Agent | Global | Project |
|---|---|---|
| Codex | `$CODEX_HOME/skills` | `.agents/skills` |
| Claude Code | `$CLAUDE_CONFIG_DIR/skills` | `.claude/skills` |
| Pi | `~/.pi/agent/skills` | `.pi/skills` |
| OpenCode | `$XDG_CONFIG_HOME/opencode/skills` | `.opencode/skills` |
| Cursor | `~/.cursor/skills` | `.agents/skills` |

The registry also describes compatibility directories. Environment variables are expanded with defaults; custom agents can be configured locally. Agent detection checks paths, not executable versions or active sessions.

## Availability and limits

Availability is calculated per installation. Identical copies can have different permissions in different projects. States include `auto`, `user-only`, `model-only`, `name-only`, `off`, `ask`, `unknown`, `not-linked`, and `n-a`. Conditions preserve project location, path restrictions, plugin enablement, and relevant settings.

- Copying preserves files but does not translate tool names, command syntax, dependencies, or agent-specific instructions.
- Pi custom discovery, session settings, and project trust are not fully modeled.
- Cursor remote/cloud availability is outside local directory discovery.
- OpenCode's alternative V2 permission schema and custom runtime configuration are not fully supported; unresolved configuration can produce `unknown`.
- Claude managed/session settings can further restrict the local estimate.
- Plugin discovery currently reads enabled Claude Code plugins. It is not a universal plugin manager.

Implementation: `registry/skill-policy.ts`, `scan/overrides.ts`, `scan/opencode-policy.ts`, `visibility/visibility.ts`, and `hub/trigger.ts` under `apps/server/src/`.
