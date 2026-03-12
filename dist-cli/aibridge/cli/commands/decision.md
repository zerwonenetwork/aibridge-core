# `aibridge decision`

## Synopsis

```
aibridge decision propose <title> <summary>
aibridge decision accept <decision-id>
aibridge decision supersede <decision-id> <new-decision-id>
aibridge decision list [--status <proposed|accepted|superseded>] [--json]
```

## Description

Manages architectural decision records (ADRs) within the project.

## Subcommands

### `decision propose`

Creates a new decision with `status: "proposed"`.

**Behavior**: Generate UUID, create `.aibridge/decisions/{id}.json`. Trigger context regeneration.

### `decision accept`

Moves a decision from `proposed` to `accepted`.

**Behavior**: Update `status` field. Trigger context regeneration.

### `decision supersede`

Marks a decision as `superseded` and links it to the replacement decision.

**Behavior**: Set old decision `status: "superseded"`. The new decision should already exist (created via `propose` + `accept`).

### `decision list`

Lists decisions with optional status filter.

## Files Written

- `.aibridge/decisions/{id}.json` — created or updated
- `.aibridge/CONTEXT.md` — regenerated

## Validation

- Title and summary must be non-empty.
- Decision ID must reference existing file.
- Status transitions: `proposed` → `accepted` or `proposed` → `superseded`. Cannot transition from `accepted` back to `proposed`.

## Exit Codes

- `0` — Success
- `1` — Invalid arguments, decision not found, or invalid transition
