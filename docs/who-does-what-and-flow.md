# Who does what — you vs agents — and how the flow works

One-page overview so you know which commands **you** run and which the **agents** run, and how the flow works.

---

## The big picture

1. **You** set up the bridge once (init, git, capture, context).
2. **You** send each agent a prompt (paste into Cursor / Antigravity chat).
3. **Agents** read CONTEXT.md and do work; they run `aibridge` commands to update tasks, logs, messages.
4. **You** run `aibridge context generate` when you want the shared picture updated (or let the agents do it).

---

## Commands YOU run (human)

All from the **project folder** (e.g. `D:\Storage\zerwone\testing\crm`).

### One-time setup

| What | Command |
|------|--------|
| Create bridge | `aibridge init --template web-app --name "ContactBridge" --description "Small CRM..." --stack react,typescript,node --multi-agent` |
| Add git (needed for capture) | `git init` |
| Add Antigravity | `aibridge agent add antigravity` |
| Install capture hooks | `aibridge capture install-hooks` |
| Check capture | `aibridge capture doctor` |
| Build the shared “what to build” doc | `aibridge context generate` |

### When you want to prompt the agents

| What | Command |
|------|--------|
| Get prompt for Cursor | `aibridge agent launch --agent cursor --tool cursor` → copy output → paste in **Cursor** chat |
| Get prompt for Antigravity | `aibridge agent launch --agent antigravity --tool cursor` → copy output → paste in **Antigravity** chat |

### From time to time (optional)

| What | Command |
|------|--------|
| Refresh CONTEXT.md so agents see latest tasks/messages | `aibridge context generate` |
| See bridge status | `aibridge status` |
| List tasks | `aibridge task list` |
| Assign a new task to an agent | `aibridge task add "Do something" --assign antigravity --priority high` then `aibridge context generate` |
| Start local dashboard (optional) | In aibridge-core: `npm run dev`. In project folder: `aibridge serve`. Then open dashboard and set path to `.aibridge`. |

**You do NOT need to** run task update, log add, message add, handoff, etc. — that’s the agents’ job when they work.

---

## Commands the AGENTS run (Cursor, Antigravity)

The agents run these from the **same project folder** when they’re doing work (they use the terminal or their tooling).

| What | Example command |
|------|------------------|
| Mark session started | `aibridge agent start --session <session-id>` |
| Refresh shared context after changes | `aibridge context generate` |
| Start a task | `aibridge task update <task-id> --status in-progress` |
| Finish a task | `aibridge task update <task-id> --status done` |
| Log what they did | `aibridge log add "implemented X" "Details" --from cursor` |
| Tell another agent something | `aibridge message add "API is ready" --from cursor --to codex` |
| Hand work to another agent | `aibridge handoff create codex "Please review the API" --from cursor` |
| See current state | `aibridge task list`, `aibridge status` |

So: **you** own setup and prompting; **agents** own updating tasks, logs, messages, handoffs, and regenerating context when they change things.

---

## How the flow works (step by step)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. YOU: One-time setup                                            │
│    git init → aibridge init → aibridge agent add antigravity      │
│    → aibridge capture install-hooks → aibridge context generate  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. YOU: Prompt each agent                                         │
│    aibridge agent launch --agent cursor ... → paste in Cursor    │
│    aibridge agent launch --agent antigravity ... → paste in      │
│    Antigravity                                                   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. AGENTS: Read and work                                          │
│    They read .aibridge/CONTEXT.md (what to build, tasks, etc.)    │
│    They code / implement.                                         │
│    They run aibridge task update, log add, message add,          │
│    context generate so the bridge stays up to date.               │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. YOU: Optional upkeep                                           │
│    aibridge context generate  (if you add tasks or want a        │
│    fresh CONTEXT for the agents)                                  │
│    aibridge status / task list  (when you want to see state)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick reference: “What do I run right now?”

- **Before the agents start:** You already did init, git, capture, and context generate. You sent the prompts. You’re done with setup.
- **Next:** Let the agents work. They will run `aibridge agent start`, then `aibridge context generate`, `aibridge task update`, `aibridge log add`, etc., as they go.
- **You only need to run something when:**  
  - You add a new task or agent: run `aibridge task add ...` or `aibridge agent add ...`, then `aibridge context generate`.  
  - You want to see status: run `aibridge status` or `aibridge task list`.

So: **you** = setup + prompt + occasional context/status; **agents** = doing the work and updating the bridge with CLI commands.
