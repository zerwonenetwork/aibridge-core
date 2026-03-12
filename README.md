# AiBridge Core

**Local-first coordination layer for multi-agent AI development.**

AiBridge gives every AI coding agent in your project a shared context directory — `.aibridge` — that tracks tasks, messages, conventions, handoffs, decisions, and agent sessions. No hosted backend required.

---

## What is `.aibridge`?

The `.aibridge` directory lives at the root of your project and acts as the single source of truth for all AI agents working in the repo. It contains:

- **CONTEXT.md** — auto-generated project context for agents to read
- **CONVENTIONS.md** — shared coding standards and workflow rules
- **state/** — JSON files for tasks, messages, handoffs, decisions, logs, sessions
- **agents/** — per-agent instruction files (Cursor, Claude Code, Codex, Copilot, Windsurf, etc.)

Every agent reads from and writes to this directory through the CLI or local service, keeping everyone in sync without any cloud dependency.

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Initialize a workspace

```bash
npm run aibridge init --name "My Project" --agents cursor,claude,codex
```

This creates the `.aibridge` directory with starter context, conventions, and agent instructions.

### 3. Start the local service + dashboard

```bash
npm run dev
```

This starts both the Vite dev server (dashboard at `http://localhost:8080`) and the local bridge API service.

### 4. Open the dashboard

Navigate to `http://localhost:8080/dashboard` to see your workspace: tasks, messages, agents, conventions, decisions, and activity — all sourced from the local `.aibridge` directory.

---

## CLI

The CLI is the primary interface for interacting with the bridge.

```bash
npm run aibridge -- <command>
```

### Core commands

| Command | Description |
|---------|-------------|
| `init` | Initialize a new `.aibridge` workspace |
| `init --interactive` | Interactive guided initialization |
| `setup plan` | Generate a project plan from a template |
| `status` | Show workspace status summary |
| `task add/list/update/done` | Manage tasks |
| `message add/list/ack` | Send and read inter-agent messages |
| `handoff create/list` | Create agent-to-agent handoffs |
| `decision add/accept/supersede/list` | Track architectural decisions |
| `convention set/show/list/sync` | Manage shared conventions |
| `log add/list` | Activity logging |
| `capture install-hooks` | Install git hooks for auto-capture |
| `capture watch` | Start file watcher for continuous capture |
| `capture doctor` | Check capture subsystem health |
| `capture status` | Show capture status |
| `serve` | Start the local HTTP/SSE service |
| `context generate` | Regenerate CONTEXT.md |
| `sync` | Sync and regenerate context |

### Examples

```bash
# Initialize with a template
npm run aibridge -- init --template web-app --name "Acme App" --description "Ship the first customer flow" --stack react,typescript --multi-agent

# Add a task
npm run aibridge -- task add "Implement auth flow" --assign cursor --priority high

# Send a message between agents
npm run aibridge -- message add "Auth module is ready for review" --from cursor --to claude

# Create a handoff
npm run aibridge -- handoff create claude "Review the auth implementation" --from cursor

# Install git hooks for auto-capture
npm run aibridge -- capture install-hooks

# Start the file watcher
npm run aibridge -- capture watch --agent cursor
```

---

## Dashboard

The local dashboard is a React-based reference UI that visualizes your `.aibridge` workspace.

**Views:**
- **Overview** — project summary, agent activity, task progress
- **Tasks** — task board with status tracking
- **Activity** — chronological activity feed
- **Messages** — inter-agent communication log
- **Agents** — agent status, sessions, heartbeats
- **Conventions** — shared rules and standards
- **Decisions** — architectural decision records
- **Settings** — local source configuration, capture status, access control

---

## Setup Engine

AiBridge includes a template-driven setup engine that generates starter plans, roles, tasks, and conventions for new projects.

### From the CLI

```bash
npm run aibridge -- setup plan --template web-app --name "My App" --description "Build a customer portal" --stack react,node --multi-agent
```

### From the dashboard

Open `http://localhost:8080/dashboard` — if no bridge is found, the onboarding guide launches a guided setup wizard.

**Available templates:** `web-app`, `api-backend`, `cli-tool`, `mobile-app`, `data-pipeline`, `library`, `monorepo`

---

## Capture Subsystem

The capture subsystem automatically records agent activity:

- **Git hooks** — capture commits, branch changes
- **File watcher** — capture file modifications in real-time
- **Agent heartbeats** — track which agents are active

```bash
# Install git hooks
npm run aibridge -- capture install-hooks

# Check health
npm run aibridge -- capture doctor

# Start watching
npm run aibridge -- capture watch --agent cursor --debounce 500
```

---

## Agent Sessions

AiBridge tracks agent lifecycle through sessions:

```bash
# Launch a new session (via dashboard or programmatically)
# Start → heartbeat → stop/recover
```

Sessions provide reliability guarantees: if an agent crashes, it can be recovered and its work preserved.

---

## Local Service

The local HTTP/SSE service exposes the bridge state over a REST API:

```bash
npm run aibridge:service
# or included automatically with: npm run dev
```

**Endpoints:**
- `GET /bridge/status` — full workspace status
- `POST /bridge/task` — create/update tasks
- `POST /bridge/message` — send messages
- `GET /bridge/setup/templates` — list setup templates
- `POST /bridge/setup/plan` — preview a setup plan
- `POST /bridge/setup/init` — initialize from a setup plan
- SSE event stream for real-time updates

---

## Project Structure

```
aibridge-core/
├── aibridge/              # Core engine
│   ├── cli/               # CLI source
│   ├── runtime/           # Runtime, state management, vite plugin
│   ├── services/          # Local HTTP/SSE service
│   ├── protocol/          # .aibridge protocol spec
│   ├── setup/             # Setup engine, templates
│   ├── capture/           # Git hooks, file watcher
│   ├── context/           # Context compiler
│   └── docs/              # Internal protocol docs
├── src/                   # Dashboard React app
│   ├── components/        # UI components (dashboard, setup, landing)
│   ├── hooks/             # React hooks (useAibridge, useProjectSetup)
│   ├── lib/               # Client libraries, types, utilities
│   └── pages/             # Page components (Index, Dashboard, Docs)
├── public/                # Static assets
├── examples/              # Example workflows (see below)
└── package.json
```

---

## Examples

See the `examples/` directory for reference workflows:

- **Solo local project** — single-agent setup with CLI
- **Multi-agent project** — coordinating Cursor + Claude + Codex
- **Setup-generated project** — using the setup engine templates
- **Capture-enabled workflow** — git hooks + file watcher
- **Agent session workflow** — session lifecycle management

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dashboard + local service |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run test suite |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run aibridge -- <cmd>` | Run CLI commands |
| `npm run aibridge:service` | Start local service standalone |

---

## Hosted Companion

AiBridge Core is the open-core, local-first foundation. A hosted companion product exists separately for teams that want cloud sync, hosted dashboards, and multi-workspace management. The hosted product is not included in this repository.

---

## License

MIT
