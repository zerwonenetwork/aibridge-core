# `aibridge handoff`

## Synopsis

```
aibridge handoff <to-agent-id> <description> [--from <agent-id>] [--tasks <task-ids>]
aibridge handoff list [--agent <agent-id>] [--json]
```

## Description

Creates a structured handoff record from one agent to another.

## Arguments & Flags

| Arg/Flag | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `to-agent-id` | string | yes | — | Target agent |
| `description` | string | yes | — | What needs to be continued, blockers, context |
| `--from` | string | no | auto-detect | Source agent (auto-detected) |
| `--tasks` | string (comma-separated) | no | — | Related task IDs to link |

## Behavior

1. Generate UUID and timestamp.
2. Create `.aibridge/handoffs/{id}.json` conforming to `handoff.schema.json`.
3. If `--tasks` provided, include as `relatedTaskIds` array.
4. Trigger context regeneration.

## Files Written

- `.aibridge/handoffs/{id}.json`
- `.aibridge/CONTEXT.md` — regenerated

## Validation

- Both `fromAgentId` and `toAgentId` must exist in `bridge.json` agents.
- Description must be non-empty.
- Task IDs (if provided) must reference existing task files.

## Exit Codes

- `0` — Success
- `1` — Invalid arguments or agent not found
