# AiBridge Examples

Reference workflows demonstrating how to use AiBridge Core in different scenarios.

---

## Solo Local Project

A single developer using one AI agent (e.g., Cursor) with AiBridge for structured task tracking and context generation.

```bash
# Initialize
npx aibridge init --name "Solo App" --agents cursor

# Add tasks
npx aibridge task add "Set up project structure" --assign cursor --priority high
npx aibridge task add "Implement core feature" --assign cursor --priority high

# Track progress
npx aibridge task in-progress task-1
npx aibridge log add "Started project setup" --from cursor
npx aibridge task done task-1

# Generate context for the agent
npx aibridge context generate
```

---

## Multi-Agent Project

Coordinating multiple AI agents (Cursor, Claude Code, Codex) on a shared codebase.

```bash
# Initialize with multiple agents
npx aibridge init --name "Team Project" --agents cursor,claude,codex

# Assign tasks to different agents
npx aibridge task add "Build API endpoints" --assign cursor --priority high
npx aibridge task add "Write test suite" --assign claude --priority medium
npx aibridge task add "Code review pass" --assign codex --priority medium

# Inter-agent messaging
npx aibridge message add "API endpoints are ready for testing" --from cursor --to claude --severity info

# Handoffs
npx aibridge handoff create claude "Review and test the API layer" --from cursor --tasks task-1

# Conventions everyone follows
npx aibridge convention set "Run tests before marking tasks done" --category workflow --from cursor

# Architectural decisions
npx aibridge decision add "REST over GraphQL" "Using REST for simplicity in V1" --status accepted --from cursor
```

---

## Setup-Generated Project

Using the setup engine to scaffold a complete project plan from a template.

```bash
# Generate a plan
npx aibridge setup plan \
  --template web-app \
  --name "Customer Portal" \
  --description "Build the first customer-facing web flow" \
  --stack react,typescript,tailwind \
  --priority speed,quality \
  --multi-agent

# Or use the interactive wizard
npx aibridge init --interactive

# Or use the dashboard onboarding flow
npx aibridge serve
# Open http://localhost:4545 and follow the guided setup
```

---

## Capture-Enabled Workflow

Using the capture subsystem to automatically track agent activity.

```bash
# Initialize
npx aibridge init --name "Captured Project" --agents cursor

# Install git hooks for commit capture
npx aibridge capture install-hooks

# Check capture health
npx aibridge capture doctor

# Start the file watcher
npx aibridge capture watch --agent cursor --debounce 500

# Work normally — captures happen automatically
# Check capture status
npx aibridge capture status
```

---

## Agent Session Workflow

Managing agent lifecycle with sessions for reliability.

```bash
# Start the local service
npx aibridge serve

# From the dashboard (http://localhost:4545/dashboard):
# 1. Navigate to Agents view
# 2. Launch a new session for an agent
# 3. Monitor heartbeats
# 4. Stop or recover sessions as needed

# Sessions track:
# - When agents start and stop
# - Heartbeat intervals (alive checks)
# - Crash recovery with state preservation
```
