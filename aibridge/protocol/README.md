# Protocol Schemas

Schemas in this folder define the `.aibridge/` file contract.

## Core files

- `bridge.schema.json` → `.aibridge/bridge.json`
- `task.schema.json` → `.aibridge/tasks/*.json`
- `log-entry.schema.json` → `.aibridge/logs/*.jsonl` entries
- `handoff.schema.json` → `.aibridge/handoffs/*.json`
- `decision.schema.json` → `.aibridge/decisions/*.json`
- `message.schema.json` → `.aibridge/messages/*.json`

## Design principles

- Human-readable plain JSON
- Stable IDs and timestamps
- Explicit agent attribution
- Backward-compatible schema versioning
