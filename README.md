# AiBridge Core

**Open-core local engine and reference standard for AI workspace coordination.**

AiBridge Core creates a shared `.aibridge` directory in your repo so multiple AI coding agents can coordinate through the same **tasks, messages, handoffs, conventions, decisions, logs, context, capture state, and agent sessions** without requiring a hosted backend.

This repository is the **local-first open-core foundation**:
- `.aibridge` protocol and reference implementation
- CLI
- local HTTP/SSE service
- local dashboard
- template-driven setup engine
- capture subsystem (git hooks + watcher)
- agent launch/heartbeat/recovery reliability layer

Hosted commercial control-plane features live in a separate product repository and are **not** included here.

---

## What AiBridge Core includes

- **`.aibridge` protocol** for local coordination state
- **CLI** for setup, tasks, messages, handoffs, decisions, conventions, logs, context, capture, and agent sessions
- **Local dashboard** at `/dashboard`
- **Local service** at `http://127.0.0.1:4545`
- **Setup engine** with reusable templates and generated starter plans
- **Capture** with git hooks and a file watcher
- **Agent reliability** through launch prompts, session tracking, heartbeats, stale detection, and recovery prompts

---

## What `.aibridge` is

The `.aibridge` directory lives at the root of a project and acts as the local source of truth for AI agent coordination.

Typical contents:

- `bridge.json` — bridge metadata and setup metadata
- `CONTEXT.md` — auto-generated current context for agents
- `CONVENTIONS.md` — human-readable conventions summary
- `agents/` — per-agent instruction files
- `tasks/` — task board state
- `messages/` — inter-agent messages
- `handoffs/` — agent-to-agent handoffs
- `decisions/` — architectural/product decisions
- `conventions/` — structured conventions
- `logs/` — activity logs
- `capture/` — watcher/hook state
- `sessions/` — agent launch and recovery state

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Initialize a workspace

Interactive:

```bash
npm run aibridge -- init --interactive
```

Template-driven:

```bash
npm run aibridge -- init --template web-app --name "My Project" --description "Ship the first working slice" --stack react,typescript --multi-agent
```

Classic direct init:

```bash
npm run aibridge -- init --name "My Project" --agents cursor,claude,codex
```

### 3. Start the local service

```bash
npm run aibridge:service
```

### 4. Start the dashboard

In a separate terminal:

```bash
npm run dev
```

### 5. Open the local workspace

Navigate to:

```text
http://localhost:8080/dashboard
```

If no bridge is found, the dashboard can launch the same setup engine used by the CLI.

---

## CLI

The CLI is the primary power-user and automation interface.

Run locally from this repo:

```bash
npm run aibridge -- <command>
```

Or after publishing/installing:

```bash
npm i -g @zerwonenetwork/aibridge-core
aibridge --help
```

### Core command groups

| Group | Examples |
|---|---|
| Setup | `init`, `init --interactive`, `setup plan` |
| Local runtime | `status`, `context generate`, `serve` |
| Tasks | `task add`, `task list`, `task update`, `task done` |
| Messages | `message add`, `message list`, `message ack` |
| Coordination | `handoff create`, `decision add`, `convention set`, `log add` |
| Capture | `capture install-hooks`, `capture watch`, `capture status`, `capture stop` |
| Agent reliability | `agent launch`, `agent start`, `agent heartbeat`, `agent stop`, `agent recover`, `agent status` |

### Examples

```bash
# Preview a generated setup plan
npm run aibridge -- setup plan --template web-app --name "Acme App" --description "Ship the first customer flow" --stack react,typescript,supabase --multi-agent

# Initialize a bridge from setup
npm run aibridge -- init --template api-backend --name "Billing API" --description "Create the first billing endpoints" --stack node,postgres --multi-agent

# Add local operational state
npm run aibridge -- task add "Implement auth flow" --assign cursor --priority high
npm run aibridge -- message add "Auth module is ready for review" --from cursor --to codex
npm run aibridge -- handoff create codex "Review the auth implementation" --from cursor

# Start the local service
npm run aibridge:service

# Install capture and start the watcher
npm run aibridge -- capture install-hooks
npm run aibridge -- capture watch --agent cursor

# Launch an agent session through the reliability layer
npm run aibridge -- agent launch --agent cursor --tool cursor
```

### Notes

- `release` and `announcement` management are **not** part of AiBridge Core CLI. Those are handled by hosted/admin UI surfaces in the separate commercial product.
- `sync` is intentionally **not implemented** here. AiBridge Core is local-first and does not ship full cloud sync.

---

## Dashboard

AiBridge Core ships a local dashboard reference app.

Current local views:
- **Overview**
- **Tasks**
- **Activity**
- **Messages**
- **Agents**
- **Conventions**
- **Decisions**
- **Settings**

The dashboard uses the local service and reads local `.aibridge` state. It does **not** include the hosted `/app` control plane.

When no bridge is available, the local dashboard can:
- open sample bridge data
- point at an existing local bridge
- launch a lightweight setup flow that uses the shared setup engine

---

## Setup Engine

AiBridge Core includes a shared setup engine used by:
- CLI
- local dashboard onboarding
- local service setup endpoints

Supported templates:
- `web-app`
- `api-backend`
- `mobile-app`
- `landing-page`
- `ai-automation`
- `research-docs`
- `empty`

The setup engine generates:
- project brief
- starter roles
- starter tasks
- starter conventions
- definition of done
- kickoff coordination
- initial local bridge state

Example:

```bash
npm run aibridge -- setup plan --template landing-page --name "Marketing Site" --description "Ship a strong narrative landing page"
```

---

## Capture subsystem

AiBridge Core can capture local development activity automatically.

Features:
- **git hooks** for commit/merge/checkout capture
- **file watcher** for local edit activity
- **capture doctor/status** for diagnostics
- **validation warning logging** for malformed capture events

Example:

```bash
npm run aibridge -- capture install-hooks
npm run aibridge -- capture doctor
npm run aibridge -- capture watch --agent cursor
```

---

## Agent reliability layer

AiBridge Core includes a launch-handshake reliability model so users do not need to manually message agents just to start or recover them.

Features:
- tool-specific launch prompts
- pending → active → stale → stopped session lifecycle
- heartbeats
- stale-session detection
- recovery prompts based on current bridge state

Example:

```bash
npm run aibridge -- agent launch --agent codex --tool codex
npm run aibridge -- agent start --session <session-id>
npm run aibridge -- agent status
npm run aibridge -- agent recover --session <session-id>
```

---

## Local service

The local service exposes bridge state over HTTP and SSE.

Start it with:

```bash
npm run aibridge:service
```

Key endpoints:
- `GET /health`
- `GET /bridge/status`
- `GET /bridge/events`
- `GET /bridge/setup/templates`
- `POST /bridge/setup/plan`
- `POST /bridge/setup/init`
- entity endpoints for tasks, messages, handoffs, decisions, conventions, logs, and agent sessions

---

## Repository structure

```text
aibridge-core/
├── aibridge/              # local runtime, CLI, service, capture, setup application
├── src/                   # local dashboard app and shared frontend client code
├── public/                # static assets
├── examples/              # reference workflows and examples
├── scripts/               # build helpers
└── package.json
```

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the local dashboard dev server |
| `npm run aibridge:service` | Start the local bridge service |
| `npm run build` | Build web app + CLI bundle |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run aibridge -- <cmd>` | Run CLI commands from source |
| `npm run aibridge:bin -- --help` | Run the built CLI bundle |

---

## What this repo is not

AiBridge Core is **not**:
- a hosted control plane
- a team dashboard product
- a cloud sync service
- a hosted release/announcement center

Those belong to the separate commercial product built on top of this local-first foundation.

---

## Publishing (maintainers)

Before publishing to npm:

1. **Verify**: `npm run typecheck && npm run test && npm run build`
2. **Audit**: `npm audit` — run `npm audit fix` for auto-fixable issues
3. **Pack check**: `npm run pack:check` — confirm `dist-cli`, `README.md`, `LICENSE` are included
4. **Publish**: `npm publish --access public`

GitHub repo settings (manual):

- **Description**: `Local-first coordination standard and reference implementation for AI workspaces.`
- **Topics**: `aibridge`, `ai`, `cli`, `developer-tools`, `local-first`, `typescript`, `workflow`, `multi-agent`, `protocol`
- **Social preview**: upload `public/og-image.png` if available

---

## License

MIT
