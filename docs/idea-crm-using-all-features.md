# CRM idea: use every AiBridge Core feature

A **small CRM (Customer Relationship Management)** app idea designed so that building it forces you to use **every** AiBridge Core feature: setup, tasks, messages, handoffs, decisions, conventions, logs, capture, agent sessions, context, local service, and dashboard.

---

## Project brief

**Name:** ContactBridge (or any name)  
**Goal:** A local-first CRM with contacts, deals (pipeline), and activity log. Multiple AI agents (e.g. Cursor, Codex, Claude) work on frontend, backend, and docs in parallel, coordinated via `.aibridge`.

**Scope (minimal):**

- **Contacts:** list, add, edit; fields: name, email, company.
- **Deals:** pipeline (stages: Lead → Qualified → Proposal → Won/Lost); link to contact.
- **Activity:** simple log of “what happened” (call, email, meeting) per contact or deal.
- **Stack:** e.g. React + TypeScript frontend, Node/Express or Supabase backend, SQLite or Supabase DB.

This size forces real tasks, handoffs, and decisions without a huge scope.

---

## How each feature gets used

| Feature | How the CRM project uses it |
|--------|------------------------------|
| **Setup / init** | `aibridge init --template web-app` (or custom) with multi-agent; setup plan with roles (frontend, backend, docs) and starter tasks. |
| **Tasks** | “Add contact list API”, “Build deal pipeline UI”, “Write API docs”, “Add contact form”, etc.; assign to cursor, codex, claude. |
| **Messages** | “Contact API is ready for frontend integration.” “Deal schema is in place; you can build the pipeline.” “Copy for empty states is in `/copy`.” |
| **Handoffs** | “Codex: take over backend after Cursor finishes the contact list UI.” “Claude: draft user guide once Codex ships the API docs.” |
| **Decisions** | “We use Supabase for auth and DB.” “Deal stages: Lead, Qualified, Proposal, Negotiation, Won, Lost.” “Contact is the source of truth; deal references contact_id.” |
| **Conventions** | “REST: GET/POST/PUT/DELETE under /api/contacts, /api/deals.” “Frontend: React Query for server state, Zustand for UI state.” “Naming: contactId, dealId in JSON.” |
| **Logs** | Daily or per-session: “Added contact list endpoint.” “Implemented pipeline view.” “Fixed contact form validation.” |
| **Capture** | Git hooks + file watcher so every commit and key file change is captured; context stays fresh for the next agent. |
| **Agent sessions** | Launch Cursor (frontend), Codex (backend), Claude (docs); heartbeat so the bridge knows they’re active; recover if stale. |
| **Context** | `aibridge context generate` so CONTEXT.md has tasks, messages, decisions, conventions, recent logs—every agent has full picture. |
| **Local service** | `aibridge serve` so the dashboard and any tooling can read/write bridge state over HTTP/SSE. |
| **Dashboard** | Overview, Tasks, Messages, Agents, Conventions, Decisions, Settings—single place to see and manage the whole CRM build. |

---

## Step-by-step: build the CRM and hit every feature

Do this in order so that no feature is skipped.

### Phase 1: Setup & protocol

1. **Init the project with aibridge (multi-agent).**
   ```bash
   mkdir contact-bridge && cd contact-bridge
   npm i -g @zerwonenetwork/aibridge-core
   aibridge init --template web-app --name "ContactBridge" --description "Small CRM with contacts, deals, activity" --stack react,typescript,node --multi-agent
   ```
   → Uses: **init**, **setup engine**, **.aibridge** (bridge.json, agents/, tasks/, etc.).

2. **Add decisions (architecture).**
   ```bash
   aibridge decision add "Use Supabase for auth and Postgres; React + TypeScript for frontend"
   aibridge decision add "Deal stages: Lead, Qualified, Proposal, Negotiation, Won, Lost"
   aibridge decision add "Contact is primary entity; Deal has contact_id"
   ```
   → Uses: **decisions**.

3. **Add conventions (code & API).**
   ```bash
   aibridge convention set "API routes live under /api/contacts and /api/deals; REST style"
   aibridge convention set "Frontend: React Query for server state, components under src/components"
   aibridge convention set "JSON uses contactId, dealId, camelCase"
   ```
   → Uses: **conventions**.

### Phase 2: Tasks & coordination

4. **Create tasks and assign to agents.**
   ```bash
   aibridge task add "Implement GET /api/contacts and POST /api/contacts" --assign codex --priority high
   aibridge task add "Build contact list page and add-contact form" --assign cursor --priority high
   aibridge task add "Add deal pipeline API (CRUD + stages)" --assign codex --priority high
   aibridge task add "Build pipeline view (board by stage)" --assign cursor --priority high
   aibridge task add "Write API and user docs" --assign claude --priority medium
   ```
   → Uses: **tasks**.

5. **Simulate progress with messages.**
   ```bash
   aibridge message add "Contacts API is ready; use GET /api/contacts and POST /api/contacts" --from codex --to cursor
   aibridge message add "Pipeline UI is blocked on deal API" --from cursor --to codex
   aibridge handoff create codex "Implement deal pipeline API next so Cursor can build the board" --from cursor
   ```
   → Uses: **messages**, **handoffs**.

6. **Log activity.**
   ```bash
   aibridge log add "Scaffolded backend and contact routes"
   aibridge log add "Added contact list and form; WIP pipeline"
   ```
   → Uses: **logs**.

### Phase 3: Context & service

7. **Generate context.**
   ```bash
   aibridge context generate
   ```
   → Uses: **context** (CONTEXT.md updated from tasks, messages, decisions, conventions, logs).

8. **Start the local service.**
   ```bash
   aibridge serve
   ```
   → Uses: **local service** (HTTP/SSE). Leave it running.

### Phase 4: Capture & agents

9. **Install capture (if the project is a git repo).**
   ```bash
   git init   # if not already
   aibridge capture install-hooks
   aibridge capture watch --agent cursor
   ```
   → Uses: **capture** (hooks + watcher). Commit or edit files to see events.

10. **Use agent sessions (optional but recommended).**
    ```bash
    aibridge agent launch --agent cursor --tool cursor
    aibridge agent launch --agent codex --tool codex
    aibridge agent status
    aibridge agent heartbeat --session <session-id>   # or let your workflow call it
    ```
    → Uses: **agent launch, start, heartbeat, status** (and **recover** if a session goes stale).

### Phase 5: Dashboard

11. **Open the dashboard.**
    - From an aibridge-core clone: `npm run dev` → open `http://localhost:8080/dashboard`.
    - Point it at the same machine; ensure the local service (step 8) is running from the CRM project.
    → Uses: **dashboard** (overview, tasks, activity, messages, agents, conventions, decisions, settings).

### Phase 6: Status & iteration

12. **Check status anytime.**
    ```bash
    aibridge status
    aibridge task list
    aibridge capture status
    ```
    → Uses: **status**, **task list**, **capture status**.

---

## Feature checklist (all boxes = all features used)

- [ ] **Init** — multi-agent bridge created
- [ ] **Setup plan / template** — used in init
- [ ] **Tasks** — add, list, assign to agents
- [ ] **Messages** — add, list (inter-agent)
- [ ] **Handoffs** — create (explicit handoff)
- [ ] **Decisions** — add (architecture & product)
- [ ] **Conventions** — set (API, code, naming)
- [ ] **Logs** — add (activity log)
- [ ] **Context** — generate (CONTEXT.md)
- [ ] **Local service** — serve (HTTP/SSE)
- [ ] **Capture** — install-hooks, watch, status (or doctor)
- [ ] **Agent sessions** — launch, status (and heartbeat/recover if you run agents)
- [ ] **Dashboard** — open and use (overview, tasks, messages, conventions, decisions, settings)

---

## Optional: custom setup template for “CRM”

To force **setup** even more, you can add a custom template (e.g. `crm`) under `aibridge/protocol/templates/` with starter tasks like “Add contact API”, “Add contact list UI”, “Add deal pipeline”, and reference it with:

```bash
aibridge init --template crm --name "ContactBridge" --multi-agent
```

That way the CRM idea is baked into the setup engine and you still use every other feature as above.
