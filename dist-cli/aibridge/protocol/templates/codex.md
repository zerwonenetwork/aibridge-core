# AiBridge Protocol — OpenAI Codex Agent Instructions

> Place this content in `AGENTS.md` at the project root.

## Identity

You are operating as a **Codex** agent within an AiBridge-coordinated project. Multiple AI agents may be working on this codebase simultaneously. Coordination is managed through the `.aibridge/` directory.

> AiBridge-generated launch prompts are the primary startup instructions. `AGENTS.md` is supportive context only.

## Protocol — 4 Phases

### Phase 1: BEFORE Working

1. **Read `.aibridge/CONTEXT.md`** — current project state, active agents, task board, recent activity, open handoffs, conventions.
2. **Acknowledge your launch session** using the exact AiBridge CLI command included in the generated launch prompt before starting work.
3. **Check `.aibridge/messages/`** for messages addressed to you (`toAgentId: "codex"`).
4. **Check `.aibridge/tasks/`** for assigned tasks. Prioritize `in_progress`, then `pending`.
5. **Review `.aibridge/handoffs/`** for handoffs directed to you.

### Phase 2: WHILE Working

1. **Follow conventions** in `.aibridge/CONVENTIONS.md`.
2. **Prefer the canonical AiBridge CLI path from the launch prompt** whenever you need to record work. Do not hand-edit bridge JSON unless you are explicitly in recovery mode and the CLI is unavailable.
3. **Log actions** to `.aibridge/logs/codex.jsonl`:
   ```json
   {"id": "<uuid>", "agentId": "codex", "action": "refactor", "description": "Extracted shared utils", "timestamp": "2025-01-15T10:30:00Z"}
   ```
4. **Record decisions** in `.aibridge/decisions/` for significant technical choices.
5. **Update task status**: `pending` → `in_progress` → `done`.

### Phase 3: AFTER Working

1. **Create handoffs** in `.aibridge/handoffs/` when another agent should continue.
2. **Update task statuses** for completed work.
3. **Regenerate context** so `CONTEXT.md` stays current.

### Phase 4: ALWAYS

- Never modify another agent's files without posting a message first.
- Never modify `.aibridge/bridge.json` directly.
- Do not hand-edit `.aibridge/*.json` files during normal operation. Use the generated launch prompt + canonical CLI path first.
- Post messages for conflicts or cross-agent coordination needs.
- Use handoffs/messages only when coordination is actually needed; normal progress does not require a message every time.
- Use UTC ISO 8601 timestamps. Generate stable UUIDs for IDs.

## File Paths

| Purpose | Path |
|---|---|
| Context summary | `.aibridge/CONTEXT.md` |
| Conventions | `.aibridge/CONVENTIONS.md` |
| Config | `.aibridge/bridge.json` |
| Your logs | `.aibridge/logs/codex.jsonl` |
| Tasks | `.aibridge/tasks/*.json` |
| Handoffs | `.aibridge/handoffs/*.json` |
| Decisions | `.aibridge/decisions/*.json` |
| Messages | `.aibridge/messages/*.json` |
| Your instructions | `.aibridge/agents/codex.md` |
