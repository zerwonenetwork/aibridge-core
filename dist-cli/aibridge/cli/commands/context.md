# `aibridge context`

## Synopsis

```
aibridge context [--output <path>] [--budget <tokens>]
```

## Description

Regenerates `.aibridge/CONTEXT.md` from the current state of all `.aibridge/` data files. Uses the deterministic context compiler algorithm.

## Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--output` | string | `.aibridge/CONTEXT.md` | Output file path |
| `--budget` | number | `2000` | Target token budget (triggers truncation) |

## Behavior

1. Read all data sources (see CONTEXT_COMPILER.md).
2. Execute the deterministic compiler algorithm.
3. Apply token budget truncation if output exceeds budget.
4. Write output atomically (temp file → rename).

## Algorithm Reference

See `aibridge/context/CONTEXT_COMPILER.md` for the full deterministic algorithm, section limits, truncation rules, and suggested actions generation logic.

## Files Read

- `.aibridge/bridge.json`
- `.aibridge/tasks/*.json`
- `.aibridge/logs/*.jsonl`
- `.aibridge/handoffs/*.json`
- `.aibridge/messages/*.json`
- `.aibridge/decisions/*.json`
- `.aibridge/CONVENTIONS.md`

## Files Written

- `.aibridge/CONTEXT.md` (or `--output` path)

## Exit Codes

- `0` — Success
- `1` — Not initialized
