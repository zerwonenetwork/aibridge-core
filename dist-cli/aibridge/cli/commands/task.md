# `aibridge task`

## Synopsis

```
aibridge task add <title> [--priority <low|medium|high>] [--assign <agent-id>]
aibridge task assign <task-id> <agent-id>
aibridge task in-progress <task-id>
aibridge task done <task-id>
aibridge task list [--status <status>] [--agent <agent-id>] [--json]
```

## Subcommands

### `task add`

Creates a new task file in `.aibridge/tasks/`.

| Arg/Flag | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `title` | string | yes | — | Task title |
| `--priority` | enum | no | `medium` | `low`, `medium`, `high` |
| `--assign` | string | no | — | Agent ID to assign |

**Behavior**: Generate UUID, create `.aibridge/tasks/{id}.json` conforming to `task.schema.json`. Set `status: "pending"`, `createdAt` and `updatedAt` to now. Trigger context regeneration.

### `task assign`

Assigns an existing task to an agent.

**Behavior**: Read task file, set `agentId`, update `updatedAt`. Trigger context regeneration.

### `task in-progress`

Moves a task to `in_progress` status.

**Behavior**: Read task file, set `status: "in_progress"`, update `updatedAt`. Trigger context regeneration.

### `task done`

Marks a task as completed.

**Behavior**: Read task file, set `status: "done"`, update `updatedAt`. Trigger context regeneration.

### `task list`

Lists tasks with optional filters.

**Behavior**: Scan `.aibridge/tasks/`, apply filters, print table or JSON.

## Files Written

- `.aibridge/tasks/{id}.json` — created or updated
- `.aibridge/CONTEXT.md` — regenerated after mutations

## Validation

- Title must be non-empty.
- Priority must be valid enum value.
- Agent ID must exist in `bridge.json` agents list.
- Task ID must reference an existing file.

## Exit Codes

- `0` — Success
- `1` — Invalid arguments or task not found
