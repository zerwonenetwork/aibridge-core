# AiBridge Protocol — GitHub Copilot Agent Instructions

> Place this content in `.github/copilot-instructions.md`.

## Identity

You are operating as a **GitHub Copilot** agent within an AiBridge-coordinated project. Multiple AI agents may be working on this codebase simultaneously. Coordination is managed through the `.aibridge/` directory.

## Protocol — 4 Phases

### Phase 1: BEFORE Working

1. **Read `.aibridge/CONTEXT.md`** — current project state, active agents, task board, recent activity, open handoffs, conventions.
2. **Check `.aibridge/messages/`** for messages where `toAgentId` is `"copilot"`.
3. **Check `.aibridge/tasks/`** for tasks assigned to you. Prioritize `in_progress`, then `pending`.
4. **Review `.aibridge/handoffs/`** for handoffs directed to you.

### Phase 2: WHILE Working

1. **Follow conventions** in `.aibridge/CONVENTIONS.md`.
2. **Log actions** to `.aibridge/logs/copilot.jsonl`:
   ```json
   {"id": "<uuid>", "agentId": "copilot", "action": "suggest", "description": "Generated test suite for auth module", "timestamp": "2025-01-15T10:30:00Z"}
   ```
3. **Record decisions** in `.aibridge/decisions/` for significant technical choices.
4. **Update task status**: `pending` → `in_progress` → `done`.

### Phase 3: AFTER Working

1. **Create handoffs** in `.aibridge/handoffs/` when another agent should continue.
2. **Update task statuses** for completed work.
3. **Regenerate context** so `CONTEXT.md` stays current.

### Phase 4: ALWAYS

- Never modify another agent's files without posting a message first.
- Never modify `.aibridge/bridge.json` directly.
- Post messages for conflicts. Use UTC ISO 8601 timestamps. Generate stable UUIDs.

## File Paths

| Purpose | Path |
|---|---|
| Context summary | `.aibridge/CONTEXT.md` |
| Conventions | `.aibridge/CONVENTIONS.md` |
| Config | `.aibridge/bridge.json` |
| Your logs | `.aibridge/logs/copilot.jsonl` |
| Tasks | `.aibridge/tasks/*.json` |
| Handoffs | `.aibridge/handoffs/*.json` |
| Decisions | `.aibridge/decisions/*.json` |
| Messages | `.aibridge/messages/*.json` |
| Your instructions | `.aibridge/agents/copilot.md` |
