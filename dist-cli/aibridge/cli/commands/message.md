# `aibridge message`

## Synopsis

```
aibridge message send <content> --from <agent-id> [--to <agent-id>] [--severity <level>]
aibridge message list [--to <agent-id>] [--severity <level>] [--unread] [--limit <n>] [--json]
aibridge message ack <message-id>
```

## Description

Send, list, and acknowledge inter-agent messages. Messages are stored as individual JSON files in `.aibridge/messages/` conforming to `message.schema.json`.

## Subcommands

### `message send`

| Arg/Flag | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `content` | string | yes | — | Message body |
| `--from` | string | yes* | auto-detect | Sending agent ID |
| `--to` | string | no | — | Recipient agent ID (omit for broadcast) |
| `--severity` | string | no | `info` | One of: `info`, `warning`, `critical` |

\* If `--from` is not provided, uses agent auto-detection (see below).

**Behavior**:
1. Validate `content` is non-empty.
2. Generate UUID for `id` and UTC ISO 8601 `timestamp`.
3. Set `acknowledged: false`.
4. Write JSON file to `.aibridge/messages/{id}.json` conforming to `message.schema.json`.
5. Trigger context regeneration.

**Output**: `✓ Message {id} sent from {fromAgentId}` + ` to {toAgentId}` if specified.

### `message list`

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--to` | string | (all) | Filter by recipient agent |
| `--severity` | string | (all) | Filter by severity level |
| `--unread` | boolean | `false` | Show only unacknowledged messages |
| `--limit` | number | `20` | Max entries to show |
| `--json` | boolean | `false` | JSON output |

**Behavior**: Read all `.json` files in `.aibridge/messages/`, apply filters, sort by timestamp desc, output formatted table or JSON.

**Table columns**: `ID (short) | From | To | Severity | Content (truncated) | Time | Ack`

### `message ack`

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `message-id` | string | yes | Full or short message ID |

**Behavior**:
1. Find message file in `.aibridge/messages/` matching ID (supports prefix match).
2. Set `acknowledged: true`.
3. Write updated file.
4. Trigger context regeneration.

**Output**: `✓ Message {id} acknowledged`

## Agent Auto-Detection

When `--from` is not provided, attempt to detect the calling agent:
1. Check `AIBRIDGE_AGENT` environment variable.
2. Check parent process name for known patterns (`cursor`, `claude`, `code` for codex, etc.).
3. Fall back to prompting the user.

## Files Read/Written

- `.aibridge/messages/*.json` — read (list/ack), written (send/ack)
- `.aibridge/CONTEXT.md` — regenerated after send/ack

## Validation

- `content` must be non-empty string.
- `severity` must be one of `info`, `warning`, `critical`.
- `fromAgentId` must be a registered agent in `bridge.json` or a valid custom ID.
- `toAgentId` (if provided) must be a registered agent.
- On `ack`, message file must exist.

## Exit Codes

- `0` — Success
- `1` — Missing required arguments or validation failure
- `2` — Message not found (ack)
