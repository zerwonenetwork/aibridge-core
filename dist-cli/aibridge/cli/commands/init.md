# `aibridge init`

## Synopsis

```
aibridge init [--name <project-name>] [--agents <agent-list>]
```

## Description

Initializes a new `.aibridge/` directory in the current project root. Idempotent — running on an existing project preserves data and only adds missing structure.

## Arguments & Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--name` | string | Directory name | Project name stored in `bridge.json` |
| `--agents` | string (comma-separated) | `"cursor"` | Initial agents to register (e.g., `"cursor,claude,codex"`) |

## Behavior

1. Check if `.aibridge/` exists. If yes, run in **merge mode** (add missing dirs/files only).
2. Create directory structure:
   ```
   .aibridge/
   ├── bridge.json
   ├── CONTEXT.md
   ├── CONVENTIONS.md
   ├── agents/
   │   └── {agent}.md (one per registered agent)
   ├── tasks/
   ├── logs/
   ├── handoffs/
   ├── decisions/
   └── messages/
   ```
3. Generate `bridge.json` with schema version `"1.0"`, project name, creation timestamp, and agent entries.
4. Generate agent instruction files from protocol templates (`aibridge/protocol/templates/{kind}.md`).
5. Create empty `CONVENTIONS.md` with header.
6. Run context compiler to generate initial `CONTEXT.md`.
7. Print summary of created files.

## Files Written

- `.aibridge/bridge.json` (created or preserved)
- `.aibridge/CONTEXT.md` (generated)
- `.aibridge/CONVENTIONS.md` (created if missing)
- `.aibridge/agents/{kind}.md` (one per agent)

## Validation

- Project name must be non-empty.
- Agent kinds must be one of: `cursor`, `claude`, `codex`, `antigravity`, `copilot`, `windsurf`, `custom`.
- If `.aibridge/bridge.json` exists, do not overwrite — print "Already initialized" and exit 0.

## Exit Codes

- `0` — Success
- `1` — Invalid arguments
