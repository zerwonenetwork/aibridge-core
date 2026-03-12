# AiBridge Protocol — Cursor Agent Instructions

> Place this content in `.cursorrules` at the project root.

## Identity

You are operating as a **Cursor** agent within an AiBridge-coordinated project. Multiple AI agents may be working on this codebase simultaneously. Coordination is managed through the `.aibridge/` directory.

> AiBridge-generated launch prompts are the primary startup instructions. `.cursorrules` is supportive context only.

## Protocol — 4 Phases

### Phase 1: BEFORE Working

1. **Read `.aibridge/CONTEXT.md`** first — it contains the current project state, active agents, task board, recent activity, open handoffs, and conventions.
2. **Acknowledge your launch session** using the exact AiBridge CLI command included in the generated launch prompt before you start real work.
3. **Check `.aibridge/messages/`** for any messages addressed to you (`toAgentId` matching your agent ID). Acknowledge critical messages before proceeding.
4. **Check `.aibridge/tasks/`** for tasks assigned to you (`agentId` matching your ID). Prioritize `in_progress` tasks, then `pending` tasks assigned to you.
5. **Review `.aibridge/handoffs/`** for any handoffs directed to you. These contain context from the previous agent's work.

### Phase 2: WHILE Working

1. **Follow all conventions** listed in `.aibridge/CONVENTIONS.md`. These are shared rules all agents must respect.
2. **Prefer the canonical AiBridge CLI path from the launch prompt** whenever you need to record work. Do not hand-edit bridge JSON unless you are explicitly in recovery mode and the CLI is unavailable.
3. **Log your actions** by appending entries to `.aibridge/logs/cursor.jsonl`. Each entry must conform to `log-entry.schema.json`:
   ```json
   {"id": "<uuid>", "agentId": "cursor", "action": "edit", "description": "Refactored auth middleware", "timestamp": "2025-01-15T10:30:00Z"}
   ```
4. **Record architectural decisions** in `.aibridge/decisions/` when making significant technical choices. Use `decision.schema.json` format.
5. **Update task status** as you work: move tasks from `pending` → `in_progress` when you start, and `in_progress` → `done` when complete.

### Phase 3: AFTER Working

1. **Create a handoff** in `.aibridge/handoffs/` if another agent needs to continue your work. Include:
   - What you completed
   - What remains
   - Any blockers or context the next agent needs
2. **Update task statuses** to reflect completed work.
3. **Regenerate context** by running `aibridge context` (or the equivalent local operation) so `CONTEXT.md` reflects your changes.

### Phase 4: ALWAYS

- **Never modify files owned by another agent** without posting a message first in `.aibridge/messages/`.
- **Never modify `.aibridge/bridge.json`** unless running an `aibridge` CLI command.
- **Do not hand-edit `.aibridge/*.json` files** during normal operation. Use the generated launch prompt + canonical CLI path first.
- **Post a message** (severity: `warning` or `critical`) if you encounter a conflict or need input from another agent.
- **Use a handoff or warning message only when needed**. Routine work should continue silently once the session is acknowledged.
- **Respect file ownership**: check `CONTEXT.md` for which agent is working on which files.
- **Use UTC ISO 8601 timestamps** for all entries.
- **Generate stable UUIDs** for all `id` fields.

## File Paths

| Purpose | Path |
|---|---|
| Context summary | `.aibridge/CONTEXT.md` |
| Conventions | `.aibridge/CONVENTIONS.md` |
| Config | `.aibridge/bridge.json` |
| Your logs | `.aibridge/logs/cursor.jsonl` |
| Tasks | `.aibridge/tasks/*.json` |
| Handoffs | `.aibridge/handoffs/*.json` |
| Decisions | `.aibridge/decisions/*.json` |
| Messages | `.aibridge/messages/*.json` |
| Your instructions | `.aibridge/agents/cursor.md` |
