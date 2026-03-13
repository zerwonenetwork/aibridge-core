# `aibridge convention`

## Synopsis

```
aibridge convention add <rule> [--category <category>]
aibridge convention remove <convention-id>
aibridge convention list [--json]
aibridge convention sync
```

## Description

Manages shared project conventions that all agents must follow.

## Subcommands

### `convention add`

Adds a new convention rule.

| Arg/Flag | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `rule` | string | yes | — | The convention text |
| `--category` | enum | no | `other` | `code-style`, `architecture`, `testing`, `documentation`, `workflow`, `other` |

**Behavior**: Generate UUID, append to `.aibridge/CONVENTIONS.md` and create `.aibridge/conventions/{id}.json` (for structured access). Trigger context regeneration.

### `convention remove`

Removes a convention by ID.

**Behavior**: Delete the convention JSON file and remove the line from `CONVENTIONS.md`. Trigger context regeneration.

### `convention list`

Lists all active conventions.

### `convention sync`

Ensures `CONVENTIONS.md` is in sync with the JSON files in `.aibridge/conventions/`. Rebuilds the markdown from structured data.

## Dual Storage

Conventions are stored in two places for different consumers:
- `.aibridge/CONVENTIONS.md` — human-readable, included in `CONTEXT.md`
- `.aibridge/conventions/{id}.json` — structured, for CLI/API operations

The `sync` subcommand reconciles these two sources.

## Files Written

- `.aibridge/CONVENTIONS.md` — updated
- `.aibridge/conventions/{id}.json` — created or deleted
- `.aibridge/CONTEXT.md` — regenerated

## Exit Codes

- `0` — Success
- `1` — Invalid arguments or convention not found
