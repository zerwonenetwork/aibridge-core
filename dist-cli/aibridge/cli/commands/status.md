# `aibridge status`

## Synopsis

```
aibridge status [--json] [--agent <agent-id>]
```

## Description

Displays current project status: active agents, task counts, recent activity, and sync state.

## Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--json` | boolean | `false` | Output as JSON instead of formatted text |
| `--agent` | string | (all) | Filter to a specific agent |

## Behavior

1. Read `.aibridge/bridge.json` for project metadata and agents.
2. Scan `.aibridge/tasks/` and aggregate counts by status.
3. Scan `.aibridge/logs/` for latest 5 entries.
4. Check `.aibridge/messages/` for unread count.
5. Check `.aibridge/handoffs/` for open handoffs.

## Output (text mode)

```
Project: my-project
Agents:  cursor, claude, codex
Synced:  2 minutes ago

Tasks:   3 pending · 2 in progress · 8 done
Messages: 1 unread (1 critical)
Handoffs: 1 open

Recent Activity:
  [10:30] cursor — edit: Refactored auth middleware
  [10:25] claude — create: Added user model
  [10:20] codex — test: Generated unit tests
```

## Output (JSON mode)

Returns full `AibridgeStatus` object matching the TypeScript interface.

## Files Read

- `.aibridge/bridge.json`
- `.aibridge/tasks/*.json`
- `.aibridge/logs/*.jsonl`
- `.aibridge/messages/*.json`
- `.aibridge/handoffs/*.json`

## Exit Codes

- `0` — Success
- `1` — Not initialized (`.aibridge/` not found)
