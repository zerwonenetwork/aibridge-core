# AiBridge Protocol — Claude Code Agent Instructions

> Place this content in `CLAUDE.md` at the project root.

## Identity

You are operating as a **Claude Code** agent within an AiBridge-coordinated project. Multiple AI agents may be working on this codebase simultaneously. Coordination is managed through the `.aibridge/` directory.

## Protocol — 4 Phases

### Phase 1: BEFORE Working

1. **Read `.aibridge/CONTEXT.md`** first — it contains the current project state, active agents, task board, recent activity, open handoffs, and conventions.
2. **Check `.aibridge/messages/`** for any messages addressed to you (`toAgentId` matching your agent ID). Acknowledge critical messages before proceeding.
3. **Check `.aibridge/tasks/`** for tasks assigned to you (`agentId` matching your ID). Prioritize `in_progress` tasks, then `pending` tasks assigned to you.
4. **Review `.aibridge/handoffs/`** for any handoffs directed to you.

### Phase 2: WHILE Working

1. **Follow all conventions** listed in `.aibridge/CONVENTIONS.md`.
2. **Log your actions** by appending entries to `.aibridge/logs/claude.jsonl`:
   ```json
   {"id": "<uuid>", "agentId": "claude", "action": "create", "description": "Added user authentication module", "timestamp": "2025-01-15T10:30:00Z"}
   ```
3. **Record architectural decisions** in `.aibridge/decisions/` when making significant technical choices.
4. **Update task status** as you work: `pending` → `in_progress` → `done`.

### Phase 3: AFTER Working

1. **Create a handoff** in `.aibridge/handoffs/` if another agent needs to continue your work.
2. **Update task statuses** to reflect completed work.
3. **Regenerate context** so `CONTEXT.md` reflects your changes.

### Phase 4: ALWAYS

- **Never modify files owned by another agent** without posting a message first.
- **Never modify `.aibridge/bridge.json`** directly.
- **Post a message** if you encounter a conflict or need input from another agent.
- **Respect file ownership**: check `CONTEXT.md` for active agent assignments.
- **Use UTC ISO 8601 timestamps** for all entries.
- **Generate stable UUIDs** for all `id` fields.

## File Paths

| Purpose | Path |
|---|---|
| Context summary | `.aibridge/CONTEXT.md` |
| Conventions | `.aibridge/CONVENTIONS.md` |
| Config | `.aibridge/bridge.json` |
| Your logs | `.aibridge/logs/claude.jsonl` |
| Tasks | `.aibridge/tasks/*.json` |
| Handoffs | `.aibridge/handoffs/*.json` |
| Decisions | `.aibridge/decisions/*.json` |
| Messages | `.aibridge/messages/*.json` |
| Your instructions | `.aibridge/agents/claude.md` |
