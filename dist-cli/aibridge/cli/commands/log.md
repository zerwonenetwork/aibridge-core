# `aibridge log`

## Synopsis

```
aibridge log <action> <description> [--agent <agent-id>]
aibridge log list [--agent <agent-id>] [--limit <n>] [--json]
```

## Description

Appends a log entry to the agent's log file, or lists recent log entries.

## Subcommands

### `log` (default — append)

| Arg/Flag | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `action` | string | yes | — | Short verb (e.g., `edit`, `create`, `refactor`, `test`, `deploy`) |
| `description` | string | yes | — | Human-readable description of what happened |
| `--agent` | string | no | auto-detect | Agent ID (auto-detected from process if possible) |

**Behavior**: Append a JSON line to `.aibridge/logs/{agentId}.jsonl` conforming to `log-entry.schema.json`. Generate UUID and UTC timestamp. Trigger context regeneration.

### `log list`

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--agent` | string | (all) | Filter by agent |
| `--limit` | number | `20` | Max entries to show |
| `--json` | boolean | `false` | JSON output |

**Behavior**: Read all `.jsonl` files, merge, sort by timestamp desc, apply filters, output.

## Agent Auto-Detection

When `--agent` is not provided, attempt to detect the calling agent:
1. Check `AIBRIDGE_AGENT` environment variable.
2. Check parent process name for known patterns (`cursor`, `claude`, `code` for codex, etc.).
3. Fall back to prompting the user.

## Files Written

- `.aibridge/logs/{agentId}.jsonl` — appended
- `.aibridge/CONTEXT.md` — regenerated

## Exit Codes

- `0` — Success
- `1` — Missing required arguments
