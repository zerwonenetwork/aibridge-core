export interface DocSection {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
}

export const docsCategories = [
  { id: "getting-started", label: "Getting Started", icon: "Rocket" },
  { id: "concepts", label: "Core Concepts", icon: "Lightbulb" },
  { id: "protocol", label: "Protocol & Schemas", icon: "FileJson" },
  { id: "cli", label: "CLI Reference", icon: "Terminal" },
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { id: "api", label: "API Reference", icon: "Globe" },
  { id: "guides", label: "Guides", icon: "BookOpen" },
  { id: "faq", label: "FAQ", icon: "HelpCircle" },
] as const;

export const docsSections: DocSection[] = [
  // ── Getting Started ──
  {
    id: "introduction",
    title: "Introduction",
    category: "getting-started",
    keywords: ["intro", "overview", "what is"],
    content: `# Introduction

AiBridge is the **coordination layer for multi-agent software projects**. It lets multiple AI coding agents — Cursor, Claude Code, Codex, Windsurf, Copilot, and more — work on the same codebase without overwriting each other's progress, losing context, or duplicating effort.

## The Problem

Modern teams use more than one AI assistant, but each tool operates in isolation:
- **No shared memory** — each agent starts from scratch every session.
- **No handoffs** — switching agents means re-explaining everything.
- **No visibility** — no one knows what any agent changed or why.

## The Solution

AiBridge creates a \`.aibridge/\` directory in your project that acts as the shared brain:
- A **protocol** of plain JSON and Markdown files every agent can read and write.
- A **CLI/runtime layer** to manage canonical tasks, messages, decisions, handoffs, and sessions.
- A **dashboard** for humans to launch, review, recover, and repair coordination in real time.
- A **local runtime** that serves bridge data to the UI without needing a cloud account.

> Files are the universal interface. Every AI tool can read and write them.`,
  },
  {
    id: "overview",
    title: "Overview",
    category: "getting-started",
    keywords: ["overview", "architecture", "components", "how it works", "structure"],
    content: `# Overview

AiBridge is composed of four layers that work together to keep every AI agent aligned.

## Architecture at a Glance

<!-- architecture-diagram -->



## The \`.aibridge/\` Directory

When you run \`aibridge init\`, a directory structure is created:

<!-- file-tree -->

Every file uses a published JSON schema, so any tool that reads files can participate in the protocol.

## Data Flow

1. **An agent works** — it reads \`CONTEXT.md\` and its own agent file to understand the current state.
2. **The runtime captures changes** — agents use CLI commands and humans use the dashboard or local service to record canonical state changes.
3. **Context is regenerated** — \`aibridge context generate\` rebuilds \`CONTEXT.md\` from all structured files.
4. **The next agent picks up** — it reads the fresh context and continues where the previous agent left off.

## Key Concepts

- **Tasks** — units of work with status (\`pending\`, \`in_progress\`, \`done\`), priority, and optional agent assignment.
- **Handoffs** — structured records of one agent passing work to another, including context and open questions.
- **Decisions** — architectural choices captured with title, summary, and timestamp so they aren't repeated.
- **Conventions** — team-level rules every agent must follow (formatting, patterns, naming, etc.).
- **Messages** — agent-to-agent notes with severity levels and acknowledgement tracking.
- **Logs** — timestamped activity records for full audit trails.

## What Makes It Different

- **File-first** — no proprietary API required; every AI tool already knows how to read files.
- **Agent-agnostic** — works with Cursor, Claude Code, Codex, Windsurf, Copilot, and custom agents.
- **Local-first** — runs entirely on your machine; cloud sync is optional.
- **Composable** — use only the pieces you need: just the protocol, or add the CLI, or the full dashboard.`,
  },
  {
    id: "quickstart",
    title: "Quick Start",
    category: "getting-started",
    keywords: ["install", "setup", "start", "begin"],
    content: `# Quick Start

Get AiBridge running in under two minutes.

## 1. Install the package

\`\`\`bash
npm install -g @zerwonenetwork/aibridge-core
\`\`\`

## 2. Initialize your project

\`\`\`bash
cd your-project
aibridge init --interactive
\`\`\`

This creates the \`.aibridge/\` directory with generated starter tasks, conventions, roles, and agent instruction files.

## 3. Preview or customize the starter plan

\`\`\`bash
aibridge setup plan --template web-app --name "Acme Web" --description "Ship the first customer-facing flow"
\`\`\`

If you already know the template and stack you want, you can initialize in one step:

\`\`\`bash
aibridge init --template web-app --name "Acme Web" --description "Ship the first customer-facing flow" --stack react,typescript,supabase --multi-agent
\`\`\`

## 4. Start the packaged dashboard

\`\`\`bash
aibridge dashboard
\`\`\`

This starts or reuses the local bridge service, backgrounds the packaged dashboard for the current workspace, and opens the browser for you.

## 5. Development mode (repo only)

\`\`\`bash
npm run dev
\`\`\`

Then open the local workspace dashboard at \`http://localhost:8080/dashboard\`.

## 6. Stay in the dashboard for normal human work

Use \`/dashboard\` to:

- initialize or connect a workspace
- launch and recover agents
- review unread messages, open handoffs, and protocol issues
- acknowledge messages, resolve handoffs, record decisions, and regenerate context

## 7. Assign your first task

\`\`\`bash
aibridge task add "Build auth flow" --assign cursor --priority high
\`\`\`

Your first task is now visible to all agents via \`CONTEXT.md\`.`,
  },
  {
    id: "installation",
    title: "Installation",
    category: "getting-started",
    keywords: ["install", "npm", "requirements", "prerequisites"],
    content: `# Installation

## Requirements

- **Node.js** 18 or later
- **npm**, **pnpm**, or **bun**
- A git-managed project (recommended)

## Package Manager Install

\`\`\`bash
# npm
npm install -g @zerwonenetwork/aibridge-core

# pnpm
pnpm add -g @zerwonenetwork/aibridge-core

# bun
bun add -g @zerwonenetwork/aibridge-core
\`\`\`

## Verify Installation

\`\`\`bash
aibridge --version
# → @zerwonenetwork/aibridge-core v0.1.x
\`\`\`

## Project Setup

Run inside any project directory:

\`\`\`bash
aibridge init
\`\`\`

### Options

| Flag | Description | Default |
|------|-------------|---------|
| \`--agents\` | Comma-separated agent list | \`cursor\` |
| \`--interactive\` | Guided setup flow in the terminal | \`false\` |
| \`--template\` | Setup template for generated starter state | none |

## Uninstall

\`\`\`bash
npm uninstall -g @zerwone/aibridge
rm -rf .aibridge/
\`\`\``,
  },
  // ── Core Concepts ──
  {
    id: "bridge-protocol",
    title: "The Bridge Protocol",
    category: "concepts",
    keywords: ["protocol", "bridge", "files", "format"],
    content: `# The Bridge Protocol

The AiBridge protocol is a set of **plain-text files** stored in \`.aibridge/\` at your project root. Every file is human-readable JSON or Markdown — no proprietary formats, no binary blobs.

## Why files?

Files are the lowest common denominator. Every AI coding tool can read files. Every version control system can diff them. Every developer can inspect them.

## Directory Structure

\`\`\`
.aibridge/
├── bridge.json          # Project config
├── CONTEXT.md           # Auto-generated state summary
├── CONVENTIONS.md       # Shared rules
├── agents/              # Per-agent instruction files
├── tasks/               # Task board (JSON per task)
├── handoffs/            # Agent-to-agent transfers
├── decisions/           # Architecture Decision Records
├── messages/            # Inter-agent messages
└── logs/                # Activity logs (JSONL)
\`\`\`

## Design Principles

1. **Human-readable** — plain JSON and Markdown, always.
2. **Stable IDs** — every entity has a unique, persistent identifier.
3. **Agent attribution** — every mutation is tagged with who did it.
4. **Backward-compatible** — schema changes are additive, never breaking.
5. **Diff-friendly** — optimized for git diffs and code review.`,
  },
  {
    id: "context-file",
    title: "CONTEXT.md",
    category: "concepts",
    keywords: ["context", "auto-generated", "summary", "state"],
    content: `# CONTEXT.md

\`CONTEXT.md\` is the single most important file in the bridge. It's an **auto-generated Markdown summary** of the entire project state that every agent reads first.

## What it contains

- **Project metadata** — name, repo path, schema version, last sync time.
- **Active agents** — who's registered and their configuration.
- **Task summary** — counts by status, details of in-progress and pending tasks.
- **Recent activity** — last N log entries showing who did what.
- **Open handoffs** — pending agent-to-agent work transfers.
- **Unread messages** — flagged communications between agents.
- **Recent decisions** — latest architecture decisions.
- **Active conventions** — current shared rules.

## When it regenerates

\`CONTEXT.md\` is regenerated automatically after every state mutation:
- Task created, updated, or completed
- Message sent or acknowledged
- Handoff created
- Decision recorded
- Convention added

## Example

\`\`\`markdown
# Project Context - My App

> Auto-generated by AiBridge. Do not edit manually.
> Last updated: 2026-03-08T14:42:00Z

## Active Agents
| Agent | Kind | Config |
|-------|------|--------|
| Cursor | cursor | .aibridge/agents/cursor.md |
| Claude | claude | .aibridge/agents/claude.md |

## Task Summary
| Status | Count |
|--------|-------|
| Pending | 3 |
| In Progress | 1 |
| Done | 5 |
\`\`\``,
  },
  {
    id: "agents-concept",
    title: "Agents",
    category: "concepts",
    keywords: ["agent", "cursor", "claude", "codex", "windsurf"],
    content: `# Agents

An **agent** in AiBridge is any AI coding tool that participates in the project. Each agent gets:

1. **An instruction file** in \`.aibridge/agents/\` — Markdown that the agent reads at session start.
2. **Attribution** — every task, message, log, and handoff tracks which agent created it.
3. **Owned paths** — optional file/directory ownership to prevent conflicts.

## Supported Agents

| Agent | Kind | Instruction File |
|-------|------|-----------------|
| Cursor | \`cursor\` | \`.cursorrules\` + \`.aibridge/agents/cursor.md\` |
| Claude Code | \`claude\` | \`CLAUDE.md\` + \`.aibridge/agents/claude.md\` |
| OpenAI Codex | \`codex\` | \`.codex/\` + \`.aibridge/agents/codex.md\` |
| Windsurf | \`windsurf\` | \`.windsurfrules\` + \`.aibridge/agents/windsurf.md\` |
| GitHub Copilot | \`copilot\` | \`.github/copilot-instructions.md\` |
| AntiGravity | \`antigravity\` | Custom config |

## Agent Instruction Template

Each agent's instruction file follows a pattern:

\`\`\`markdown
# [Agent Name]

Read \`CONTEXT.md\` first, then follow the conventions in \`CONVENTIONS.md\`.

## Your Role
[Specific responsibilities for this agent]

## Owned Paths
[Files/directories this agent is responsible for]
\`\`\`

## Adding a Custom Agent

\`\`\`bash
aibridge init --agents myagent:custom
\`\`\``,
  },
  {
    id: "tasks-concept",
    title: "Tasks",
    category: "concepts",
    keywords: ["task", "board", "assign", "priority", "status"],
    content: `# Tasks

Tasks are the shared work items that agents coordinate around. Each task is a JSON file in \`.aibridge/tasks/\`.

## Task Schema

\`\`\`json
{
  "id": "task-auth-flow",
  "title": "Build authentication flow",
  "status": "in_progress",
  "priority": "high",
  "assignedTo": "cursor",
  "createdAt": "2026-03-08T10:00:00Z",
  "updatedAt": "2026-03-08T14:30:00Z"
}
\`\`\`

## Status Lifecycle

\`\`\`
pending → in_progress → done
\`\`\`

## Priority Levels

| Level | When to use |
|-------|-------------|
| \`high\` | Blocking other work, ship-critical |
| \`medium\` | Important but not blocking |
| \`low\` | Nice-to-have, backlog items |

## CLI Commands

\`\`\`bash
# Create a task
aibridge task add "Build login page" --assign cursor --priority high

# Move to in-progress
aibridge task in-progress task-login-page

# Mark done
aibridge task done task-login-page

# List all tasks
aibridge task list
\`\`\``,
  },
  {
    id: "handoffs-concept",
    title: "Handoffs",
    category: "concepts",
    keywords: ["handoff", "transfer", "agent-to-agent"],
    content: `# Handoffs

A **handoff** is a structured transfer of work from one agent to another. It records what was done, what's remaining, and any context the receiving agent needs.

## Why Handoffs?

When you switch from Cursor to Claude Code mid-feature, the new agent has zero context about:
- What's already been built
- What approach was taken
- What's left to do

Handoffs solve this by creating an explicit record.

## Handoff Schema

\`\`\`json
{
  "id": "handoff-ui-to-runtime",
  "fromAgentId": "cursor",
  "toAgentId": "codex",
  "description": "The dashboard shell is ready. Finish the runtime parser and route status through a shared adapter.",
  "timestamp": "2026-03-08T13:50:00Z",
  "relatedTaskIds": ["task-dashboard-hook", "task-local-runtime"]
}
\`\`\`

## CLI Usage

\`\`\`bash
aibridge handoff create codex "Dashboard shell ready. Wire up the real data source." --from cursor
\`\`\`

The handoff is automatically included in the next \`CONTEXT.md\` regeneration so the receiving agent sees it immediately.`,
  },
  {
    id: "messages-concept",
    title: "Messages",
    category: "concepts",
    keywords: ["message", "communication", "inter-agent", "severity"],
    content: `# Messages

Messages enable **asynchronous communication between agents**. Unlike handoffs (which transfer work), messages are notifications, warnings, or requests.

## Severity Levels

| Severity | Use case |
|----------|----------|
| \`info\` | General updates, FYI notes |
| \`warning\` | Potential issues, things to watch |
| \`critical\` | Blocking problems, urgent requests |

## Message Schema

\`\`\`json
{
  "id": "msg-runtime-gap",
  "fromAgentId": "windsurf",
  "toAgentId": "all",
  "severity": "critical",
  "content": "The dashboard still needs a non-mock bridge source that survives refreshes.",
  "timestamp": "2026-03-08T12:30:00Z",
  "acknowledged": false
}
\`\`\`

## CLI Usage

\`\`\`bash
# Send to a specific agent
aibridge message add "Please review the auth middleware" --from claude --to cursor --severity warning

# Broadcast to all agents
aibridge message add "Deploy freeze until tests pass" --from claude --severity critical

# Acknowledge a message
aibridge message ack msg-runtime-gap
\`\`\`

Unread messages appear in \`CONTEXT.md\` and the dashboard notification badge.`,
  },
  {
    id: "decisions-concept",
    title: "Decisions",
    category: "concepts",
    keywords: ["decision", "adr", "architecture", "record"],
    content: `# Decisions

Decisions are **Architecture Decision Records (ADRs)** that capture important technical choices. They prevent agents from re-debating settled decisions or making contradictory choices.

## Decision Status

\`\`\`
proposed → accepted → superseded
\`\`\`

## Decision Schema

\`\`\`json
{
  "id": "decision-vite-local-api",
  "title": "Serve bridge data through Vite middleware",
  "summary": "Browser code cannot read .aibridge/ directly, so the local runtime should sit behind a dev-friendly local API.",
  "timestamp": "2026-03-08T11:00:00Z",
  "status": "accepted"
}
\`\`\`

## CLI Usage

\`\`\`bash
# Add a decision
aibridge decision add "Use PostgreSQL" "SQLite doesn't support concurrent writes well enough for our sync needs."

# Accept a decision
aibridge decision accept decision-use-postgres

# Supersede a decision
aibridge decision supersede decision-use-postgres
\`\`\``,
  },
  {
    id: "conventions-concept",
    title: "Conventions",
    category: "concepts",
    keywords: ["convention", "rule", "shared", "team"],
    content: `# Conventions

Conventions are **shared rules that all agents must follow**. They're stored in \`CONVENTIONS.md\` and enforced by each agent reading the file at session start.

## Convention Schema

Each convention has:
- A unique ID
- The rule text
- A category (\`code-style\`, \`architecture\`, \`testing\`, \`documentation\`, \`workflow\`)
- Timestamp and author

## Example Conventions

\`\`\`markdown
1. All API responses must use the \`{ data, error, meta }\` envelope format.
2. Database migrations must be reversible.
3. Every new endpoint requires at least one integration test.
4. Use \`snake_case\` for database columns, \`camelCase\` for TypeScript.
5. Commit messages follow Conventional Commits format.
\`\`\`

## CLI Usage

\`\`\`bash
# Add a convention
aibridge convention set "All API responses use { data, error, meta } envelope" --category architecture

# List conventions
aibridge convention list
\`\`\``,
  },
  // ── Protocol & Schemas ──
  {
    id: "bridge-json",
    title: "bridge.json",
    category: "protocol",
    keywords: ["config", "configuration", "bridge.json", "schema"],
    content: `# bridge.json

The root configuration file for an AiBridge project.

## Schema

\`\`\`json
{
  "$schema": "https://example.com/aibridge/schemas/bridge.schema.json",
  "schemaVersion": "1.0",
  "projectName": "My Project",
  "createdAt": "2026-03-01T00:00:00Z",
  "agents": [
    {
      "id": "cursor",
      "name": "Cursor",
      "kind": "cursor",
      "configPath": ".aibridge/agents/cursor.md"
    },
    {
      "id": "claude",
      "name": "Claude Code",
      "kind": "claude",
      "configPath": ".aibridge/agents/claude.md"
    }
  ]
}
\`\`\`

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`schemaVersion\` | string | ✅ | Protocol version (currently \`"1.0"\`) |
| \`projectName\` | string | ✅ | Human-readable project name |
| \`createdAt\` | ISO 8601 | ✅ | When the bridge was initialized |
| \`agents\` | Agent[] | ✅ | Registered agents |

## Agent Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`id\` | string | ✅ | Unique agent identifier |
| \`name\` | string | ✅ | Display name |
| \`kind\` | enum | ✅ | One of: \`cursor\`, \`claude\`, \`codex\`, \`windsurf\`, \`copilot\`, \`antigravity\`, \`custom\` |
| \`configPath\` | string | ✅ | Path to agent instruction file |
| \`ownedPaths\` | string[] | ❌ | Files/dirs this agent owns |`,
  },
  {
    id: "task-schema",
    title: "Task Schema",
    category: "protocol",
    keywords: ["task", "schema", "json", "format"],
    content: `# Task Schema

Each task is stored as a JSON file in \`.aibridge/tasks/\`.

## Full Schema

\`\`\`json
{
  "$schema": "https://example.com/aibridge/schemas/task.schema.json",
  "id": "task-build-auth",
  "title": "Build authentication flow",
  "status": "in_progress",
  "priority": "high",
  "assignedTo": "cursor",
  "createdAt": "2026-03-08T10:00:00Z",
  "updatedAt": "2026-03-08T14:30:00Z",
  "description": "Implement login, signup, and password reset with Supabase Auth.",
  "tags": ["auth", "frontend"],
  "relatedDecisionIds": ["decision-use-supabase"]
}
\`\`\`

## Required Fields

| Field | Type | Constraints |
|-------|------|-------------|
| \`id\` | string | Must be unique, kebab-case recommended |
| \`title\` | string | Human-readable title |
| \`status\` | enum | \`"pending"\` \\| \`"in_progress"\` \\| \`"done"\` |
| \`priority\` | enum | \`"low"\` \\| \`"medium"\` \\| \`"high"\` |
| \`createdAt\` | ISO 8601 | Immutable after creation |
| \`updatedAt\` | ISO 8601 | Updated on every mutation |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| \`assignedTo\` | string | Agent ID |
| \`description\` | string | Detailed description |
| \`tags\` | string[] | Categorization tags |
| \`relatedDecisionIds\` | string[] | Linked decisions |`,
  },
  {
    id: "log-schema",
    title: "Log Entry Schema",
    category: "protocol",
    keywords: ["log", "jsonl", "activity", "entry"],
    content: `# Log Entry Schema

Activity logs are stored as **JSONL** (one JSON object per line) in \`.aibridge/logs/\`. This format is append-only and merge-friendly.

## Entry Format

\`\`\`json
{"id":"log-001","agentId":"cursor","action":"edit","description":"Updated auth middleware to check JWT expiry","timestamp":"2026-03-08T14:35:00Z"}
{"id":"log-002","agentId":"claude","action":"review","description":"Reviewed CLI command naming conventions","timestamp":"2026-03-08T13:45:00Z"}
\`\`\`

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`id\` | string | ✅ | Unique entry ID |
| \`agentId\` | string | ✅ | Which agent performed the action |
| \`action\` | string | ✅ | Action type (e.g., \`edit\`, \`create\`, \`review\`, \`deploy\`) |
| \`description\` | string | ✅ | Human-readable description |
| \`timestamp\` | ISO 8601 | ✅ | When it happened |
| \`metadata\` | object | ❌ | Arbitrary key-value metadata |

## Why JSONL?

- **Append-only** — new entries are added to the end, never rewriting existing lines.
- **Merge-friendly** — git can merge concurrent appends without conflicts.
- **Streamable** — can be processed line-by-line without loading the entire file.`,
  },
  {
    id: "handoff-schema",
    title: "Handoff Schema",
    category: "protocol",
    keywords: ["handoff", "schema", "json"],
    content: `# Handoff Schema

Each handoff is a JSON file in \`.aibridge/handoffs/\`.

## Schema

\`\`\`json
{
  "$schema": "https://example.com/aibridge/schemas/handoff.schema.json",
  "id": "handoff-ui-to-runtime",
  "fromAgentId": "cursor",
  "toAgentId": "codex",
  "description": "Dashboard shell is ready. Finish the runtime parser and route status through a shared adapter.",
  "timestamp": "2026-03-08T13:50:00Z",
  "relatedTaskIds": ["task-dashboard-hook", "task-local-runtime"],
  "context": {
    "completedWork": "Built all dashboard panels with mock data",
    "remainingWork": "Replace mock data hook with real file-backed runtime",
    "notes": "The useAibridge hook interface should stay the same"
  }
}
\`\`\`

## Fields

| Field | Type | Required |
|-------|------|----------|
| \`id\` | string | ✅ |
| \`fromAgentId\` | string | ✅ |
| \`toAgentId\` | string | ✅ |
| \`description\` | string | ✅ |
| \`timestamp\` | ISO 8601 | ✅ |
| \`relatedTaskIds\` | string[] | ❌ |
| \`context\` | object | ❌ |`,
  },
  {
    id: "message-schema",
    title: "Message Schema",
    category: "protocol",
    keywords: ["message", "schema", "json"],
    content: `# Message Schema

Each message is a JSON file in \`.aibridge/messages/\`.

## Schema

\`\`\`json
{
  "$schema": "https://example.com/aibridge/schemas/message.schema.json",
  "id": "msg-deploy-freeze",
  "fromAgentId": "claude",
  "toAgentId": "all",
  "severity": "critical",
  "content": "Deploy freeze until integration tests pass.",
  "timestamp": "2026-03-08T15:00:00Z",
  "acknowledged": false
}
\`\`\`

## Fields

| Field | Type | Required | Values |
|-------|------|----------|--------|
| \`id\` | string | ✅ | Unique ID |
| \`fromAgentId\` | string | ✅ | Sender agent |
| \`toAgentId\` | string | ❌ | Recipient (\`"all"\` for broadcast) |
| \`severity\` | enum | ✅ | \`info\`, \`warning\`, \`critical\` |
| \`content\` | string | ✅ | Message body |
| \`timestamp\` | ISO 8601 | ✅ | When sent |
| \`acknowledged\` | boolean | ✅ | Read status |`,
  },
  {
    id: "decision-schema",
    title: "Decision Schema",
    category: "protocol",
    keywords: ["decision", "schema", "adr"],
    content: `# Decision Schema

Decisions are stored as JSON files in \`.aibridge/decisions/\`.

## Schema

\`\`\`json
{
  "$schema": "https://example.com/aibridge/schemas/decision.schema.json",
  "id": "decision-use-supabase",
  "title": "Use Supabase for persistence and auth",
  "summary": "Supabase provides auth, real-time, and PostgreSQL out of the box, reducing infrastructure setup time significantly.",
  "timestamp": "2026-03-08T11:00:00Z",
  "status": "accepted",
  "supersedes": "decision-use-sqlite",
  "decidedBy": "claude",
  "alternatives": [
    { "title": "SQLite + custom auth", "reason": "Rejected: doesn't handle concurrent writes" },
    { "title": "Firebase", "reason": "Rejected: vendor lock-in concerns" }
  ]
}
\`\`\`

## Status Transitions

| From | To | Meaning |
|------|----|---------|
| \`proposed\` | \`accepted\` | Team agrees |
| \`accepted\` | \`superseded\` | Replaced by newer decision |`,
  },
  // ── CLI Reference ──
  {
    id: "cli-init",
    title: "aibridge init",
    category: "cli",
    keywords: ["init", "initialize", "setup", "create"],
    content: `# aibridge init

Initialize a new AiBridge bridge in the current project.

## Usage

\`\`\`bash
aibridge init [options]
\`\`\`

## Options

| Flag | Description | Default |
|------|-------------|---------|
| \`--template <id>\` | Generate starter state from a setup template | none |
| \`--name <project>\` | Project name for bridge metadata | current directory |
| \`--description <goal>\` | Short project goal | none |
| \`--agents <list>\` | Comma-separated agent IDs | \`cursor\` |
| \`--stack <a,b>\` | Preferred stack/tooling choices for setup-backed init | none |
| \`--priority <a,b>\` | Delivery priorities such as \`speed,quality\` | template defaults |
| \`--single-agent\` / \`--multi-agent\` | Team mode for generated roles/tasks | template default |
| \`--constraint <a,b>\` | Hard constraints to include in the brief | none |
| \`--instructions <text>\` | Custom setup instructions | none |
| \`--existing-repo\` | Treat the target as an existing repository | \`false\` |
| \`--existing-files <summary>\` | Describe existing files/surfaces for setup planning | none |
| \`--clear-existing\` | Clear starter state before setup-backed init | \`false\` |
| \`--interactive\` | Guided questionnaire in the terminal | \`false\` |

## What it creates

\`\`\`
.aibridge/
├── bridge.json
├── CONTEXT.md
├── CONVENTIONS.md
├── agents/
│   └── cursor.md
├── tasks/
├── handoffs/
├── decisions/
├── messages/
└── logs/
\`\`\`

## Examples

\`\`\`bash
# Guided setup
aibridge init --interactive

# Template-backed multi-agent setup
aibridge init --template web-app --name "Acme Web" --description "Ship the first customer-facing flow" --stack react,typescript,supabase --multi-agent

# Classic bridge bootstrap
aibridge init --name "Infra Sandbox" --agents cursor,claude
\`\`\``,
  },
  {
    id: "cli-status",
    title: "aibridge status",
    category: "cli",
    keywords: ["status", "state", "overview"],
    content: `# aibridge status

Show the current state of the bridge.

## Usage

\`\`\`bash
aibridge status [options]
\`\`\`

## Options

| Flag | Description |
|------|-------------|
| \`--json\` | Output as JSON instead of formatted text |
| \`--verbose\` | Include full task details |

## Output

\`\`\`
AiBridge Status
═══════════════

Project: My App
Agents:  cursor, claude, codex
Schema:  1.0

Tasks     3 pending · 1 in-progress · 5 done
Messages  2 unread (1 critical)
Handoffs  1 open
\`\`\``,
  },
  {
    id: "cli-task",
    title: "aibridge task",
    category: "cli",
    keywords: ["task", "add", "assign", "done", "in-progress"],
    content: `# aibridge task

Manage the shared task board.

## Subcommands

### \`aibridge task add\`

\`\`\`bash
aibridge task add <title> [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`--assign <agent>\` | Assign to an agent |
| \`--priority <level>\` | \`low\`, \`medium\`, or \`high\` |
| \`--description <text>\` | Optional description |

### \`aibridge task in-progress\`

\`\`\`bash
aibridge task in-progress <task-id>
\`\`\`

### \`aibridge task done\`

\`\`\`bash
aibridge task done <task-id>
\`\`\`

### \`aibridge task list\`

\`\`\`bash
aibridge task list [--status pending|in_progress|done] [--agent <id>]
\`\`\`

## Examples

\`\`\`bash
aibridge task add "Implement search" --assign cursor --priority high
aibridge task in-progress task-implement-search
aibridge task done task-implement-search
aibridge task list --status pending
\`\`\``,
  },
  {
    id: "cli-message",
    title: "aibridge message",
    category: "cli",
    keywords: ["message", "send", "acknowledge"],
    content: `# aibridge message

Send and manage inter-agent messages.

## Subcommands

### \`aibridge message add\`

\`\`\`bash
aibridge message add <content> --from <agent-id> [--to <agent-id>] [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`--severity\` | \`info\`, \`warning\`, or \`critical\` |
| \`--from <agent>\` | Sender agent (required) |
| \`--to <agent>\` | Optional recipient; omit for a broadcast-style notice |

### \`aibridge message ack\`

\`\`\`bash
aibridge message ack <message-id>
\`\`\`

### \`aibridge message list\`

\`\`\`bash
aibridge message list [--unread] [--severity critical] [--to <agent-id>] [--limit <n>]
\`\`\`

## Examples

\`\`\`bash
# Send a warning to cursor
aibridge message add "Auth middleware needs JWT refresh" --from claude --to cursor --severity warning

# Broadcast critical message
aibridge message add "Deploy freeze active" --from claude --severity critical

# Acknowledge
aibridge message ack msg-deploy-freeze
\`\`\``,
  },
  {
    id: "cli-agent",
    title: "aibridge agent",
    category: "cli",
    keywords: ["agent", "launch", "handshake", "recover", "status"],
    content: `# aibridge agent

Launch, acknowledge, monitor, and recover agent sessions through the local reliability layer.

## Subcommands

### \`aibridge agent launch\`

\`\`\`bash
aibridge agent launch --agent <agent-id> --tool <cursor|codex> [--source <dashboard|app|cli>]
\`\`\`

Generates the exact startup prompt the user should paste into Cursor or Codex. The session is recorded as \`pending\` until it is acknowledged.

### \`aibridge agent start\`

\`\`\`bash
aibridge agent start --session <session-id>
\`\`\`

Marks the launch handshake as acknowledged and the session as \`active\`.

### \`aibridge agent heartbeat\`

\`\`\`bash
aibridge agent heartbeat --session <session-id>
\`\`\`

Refreshes liveness after meaningful activity or after a recovery prompt is followed.

### \`aibridge agent recover\`

\`\`\`bash
aibridge agent recover --session <session-id> [--json]
\`\`\`

Prints the generated restart prompt when a session is stale or stopped mid-task.

### \`aibridge agent status\`

\`\`\`bash
aibridge agent status [--agent <agent-id>] [--tool <cursor|codex>] [--status <pending|active|stale|stopped|failed>] [--json]
\`\`\`

## Examples

\`\`\`bash
aibridge agent launch --agent cursor --tool cursor
aibridge agent start --session session-123
aibridge agent heartbeat --session session-123
aibridge agent recover --session session-123
aibridge agent stop --session session-123 --reason "Paused for review"
\`\`\``,
  },
  {
    id: "cli-handoff",
    title: "aibridge handoff",
    category: "cli",
    keywords: ["handoff", "transfer"],
    content: `# aibridge handoff

Create agent-to-agent work transfers.

## Usage

\`\`\`bash
aibridge handoff create <to-agent-id> <description> --from <from-agent-id> [options]
\`\`\`

## Options

| Flag | Description |
|------|-------------|
| \`--from <agent>\` | Source agent (required) |
| \`--tasks <ids>\` | Comma-separated related task IDs |

## Examples

\`\`\`bash
# Basic handoff
aibridge handoff create claude "Auth UI is done. Build the API middleware." --from cursor

# With related tasks
aibridge handoff create codex "Dashboard shell ready" --from cursor --tasks task-dashboard,task-runtime
\`\`\``,
  },
  {
    id: "cli-decision",
    title: "aibridge decision",
    category: "cli",
    keywords: ["decision", "propose", "accept"],
    content: `# aibridge decision

Record architecture decisions.

## Subcommands

### \`aibridge decision add\`

\`\`\`bash
aibridge decision add <title> <summary> [--status <proposed|accepted|superseded>] [--from <agent>]
\`\`\`

### \`aibridge decision accept\`

\`\`\`bash
aibridge decision accept <decision-id>
\`\`\`

### \`aibridge decision supersede\`

\`\`\`bash
aibridge decision supersede <decision-id> [--from <agent>]
\`\`\`

## Examples

\`\`\`bash
aibridge decision add "Use Supabase" "Built-in auth and real-time sync" --status accepted
aibridge decision accept decision-use-supabase
\`\`\``,
  },
  {
    id: "cli-convention",
    title: "aibridge convention",
    category: "cli",
    keywords: ["convention", "rule", "add"],
    content: `# aibridge convention

Manage shared project conventions.

## Subcommands

### \`aibridge convention set\`

\`\`\`bash
aibridge convention set <rule> [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`--category\` | \`code-style\`, \`architecture\`, \`testing\`, \`documentation\`, \`workflow\` |

### \`aibridge convention list\`

\`\`\`bash
aibridge convention list [--category architecture]
\`\`\`

## Examples

\`\`\`bash
aibridge convention set "All API responses use { data, error, meta } envelope" --category architecture
aibridge convention set "Commit messages follow Conventional Commits" --category workflow
\`\`\``,
  },
  {
    id: "cli-sync",
    title: "aibridge context generate",
    category: "cli",
    keywords: ["sync", "context", "generate", "regenerate"],
    content: `# aibridge context generate

Regenerate the CONTEXT.md file from bridge state.

## Usage

\`\`\`bash
aibridge context generate [options]
\`\`\`

## Options

| Flag | Description |
|------|-------------|
| \`--output <path>\` | Write to a custom path instead of .aibridge/CONTEXT.md |
| \`--budget <tokens>\` | Limit output size for context-window constraints |

> **Note:** This command rebuilds CONTEXT.md from all structured files in .aibridge/. It does not perform cloud sync — AiBridge Local V1 operates entirely on local files.

## Examples

\`\`\`bash
# Regenerate context
aibridge context generate

# Output to a custom location
aibridge context generate --output ./CONTEXT.md
\`\`\``,
  },
  // ── Dashboard ──
  {
    id: "dashboard-overview",
    title: "Dashboard Overview",
    category: "dashboard",
    keywords: ["dashboard", "ui", "overview", "panels"],
    content: `# Dashboard

The AiBridge dashboard provides a **real-time operator console** for your bridge state. It is the primary human workflow for setup, launch, review, recovery, and protocol repair.

## Accessing the Dashboard

AiBridge Core ships the **local workspace** surface at \`/dashboard\`. Hosted control-plane features live in a separate product.

Start the local bridge service:

\`\`\`bash
aibridge serve
\`\`\`

Then open:

- Local workspace: \`http://localhost:8080/dashboard\`

## Views

| View | Description |
|------|-------------|
| **Overview** | Summary cards, task distribution, recent activity, and decisions |
| **Inbox** | Human operator queue for unread messages, open handoffs, stale sessions, and protocol issues |
| **Tasks** | Kanban-style task board with drag-and-drop |
| **Activity** | Chronological feed of all agent actions |
| **Messages** | Inter-agent communication plus send and acknowledge actions |
| **Agents** | Agent cards with session reliability, launch prompts, recovery, and handoff actions |
| **Conventions** | Active rules with category filtering |
| **Decisions** | ADR timeline with status badges and status updates |
| **Settings** | Mode selection, source configuration, profile |

## Data Sources

The local dashboard supports multiple bridge sources:

| Mode | Source | Description |
|------|--------|-------------|
| Local (Sample) | \`public/examples/\` | Bundled realistic dataset |
| Local (Workspace) | \`.aibridge/\` | Your actual project bridge |
| Local (Custom) | Any path | Point to any bridge directory |`,
  },
  {
    id: "dashboard-settings",
    title: "Dashboard Settings",
    category: "dashboard",
    keywords: ["settings", "configuration", "mode", "theme"],
    content: `# Dashboard Settings

## Runtime Mode

Switch between data sources in Settings → Runtime:

- **Demo mode** — built-in mock data, great for exploring the UI.
- **Local mode** — connect to real bridge data from your filesystem.

### Local Sources

When in local mode, choose a source:

| Source | Description |
|--------|-------------|
| Sample | Bundled example bridge in \`public/examples/\` |
| Workspace | Your project's \`.aibridge/\` directory |
| Custom | Any absolute path to a bridge root |

## Theme

Toggle between light and dark mode. The dashboard respects your system preference by default.

## Profile

Manage your display name and avatar (requires authentication).

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| \`⌘K\` / \`Ctrl+K\` | Open command palette |
| \`⌘+1-7\` | Switch between views |
| \`Escape\` | Close modals and panels |`,
  },
  // ── API Reference ──
  {
    id: "api-overview",
    title: "API Overview",
    category: "api",
    keywords: ["api", "rest", "endpoints", "http"],
    content: `# API Reference

The AiBridge local service exposes a REST API for the dashboard and external integrations.

## Base URL

\`\`\`
http://127.0.0.1:4545
\`\`\`

## Authentication

No authentication required for local mode. Future cloud mode will use API keys.

## Response Envelope

All responses follow a consistent envelope:

### Read Endpoints

\`\`\`json
{
  "data": { ... },
  "runtime": { "mode": "local", "source": "sample" },
  "revision": "abc123"
}
\`\`\`

### Mutation Endpoints

\`\`\`json
{
  "data": { ... },
  "status": { "ok": true },
  "runtime": { ... },
  "revision": "def456"
}
\`\`\`

## Runtime Selection

Every endpoint accepts a \`source\` query parameter:

\`\`\`bash
# Use sample data
GET /bridge/tasks?source=sample

# Use workspace .aibridge/
GET /bridge/tasks?source=workspace

# Use custom path
GET /bridge/tasks?source=custom&root=/path/to/.aibridge
\`\`\``,
  },
  {
    id: "api-endpoints",
    title: "Endpoints",
    category: "api",
    keywords: ["endpoints", "routes", "health", "tasks", "messages"],
    content: `# API Endpoints

## Health

\`\`\`
GET /health
\`\`\`

Returns \`200 OK\` if the service is running.

## Status & Context

\`\`\`
GET  /bridge/status           # Full bridge status
POST /bridge/context/generate  # Regenerate CONTEXT.md
\`\`\`

## Tasks

\`\`\`
GET   /bridge/tasks       # List all tasks
POST  /bridge/tasks       # Create a task
PATCH /bridge/tasks/:id   # Update a task
\`\`\`

## Messages

\`\`\`
GET   /bridge/messages         # List messages
POST  /bridge/messages         # Send a message
PATCH /bridge/messages/:id/ack # Acknowledge a message
\`\`\`

## Handoffs

\`\`\`
GET  /bridge/handoffs    # List handoffs
POST /bridge/handoffs    # Create a handoff
\`\`\`

## Decisions

\`\`\`
GET   /bridge/decisions       # List decisions
POST  /bridge/decisions       # Record a decision
PATCH /bridge/decisions/:id   # Update status
\`\`\`

## Conventions

\`\`\`
GET  /bridge/conventions              # List conventions
GET  /bridge/conventions?format=markdown  # Get as Markdown
POST /bridge/conventions              # Add a convention
\`\`\`

## Logs

\`\`\`
GET  /bridge/logs    # List log entries
POST /bridge/logs    # Append a log entry
\`\`\`

## Change Stream (SSE)

\`\`\`
GET /bridge/events
\`\`\`

Server-Sent Events:
- \`ready\` — connection established
- \`bridge.changed\` — bridge state updated`,
  },
  // ── Guides ──
  {
    id: "guide-multi-agent",
    title: "Multi-Agent Workflow",
    category: "guides",
    keywords: ["workflow", "multi-agent", "team", "parallel"],
    content: `# Multi-Agent Workflow Guide

This guide walks through a real-world scenario of using multiple AI agents on the same project.

## Scenario

You're building a full-stack app and want to use:
- **Cursor** for frontend UI work
- **Claude Code** for backend API and business logic
- **Codex** for infrastructure and DevOps

## Step 1: Initialize

\`\`\`bash
aibridge init --agents cursor,claude,codex
\`\`\`

## Step 2: Define conventions

\`\`\`bash
aibridge convention set "Use TypeScript strict mode" --category code-style
aibridge convention set "All API responses use { data, error } envelope" --category architecture
aibridge convention set "Write tests for every new module" --category testing
\`\`\`

## Step 3: Create and assign tasks

\`\`\`bash
aibridge task add "Build login page" --assign cursor --priority high
aibridge task add "Create auth API" --assign claude --priority high
aibridge task add "Set up CI pipeline" --assign codex --priority medium
\`\`\`

## Step 4: Work in parallel

Each agent reads \`CONTEXT.md\` at session start and sees:
- Their assigned tasks
- Active conventions
- What other agents are working on

## Step 5: Handoff when needed

\`\`\`bash
aibridge handoff create claude "Login UI done, needs API endpoints for /auth/login and /auth/signup" --from cursor
\`\`\`

## Step 6: Record decisions

\`\`\`bash
aibridge decision add "Use JWT with refresh tokens" "Better security than session cookies for API-first arch"
\`\`\``,
  },
  {
    id: "guide-migration",
    title: "Migrating Existing Projects",
    category: "guides",
    keywords: ["migration", "existing", "convert", "adopt"],
    content: `# Migrating Existing Projects

Already have a project with AI coding tools? Here's how to adopt AiBridge.

## Step 1: Initialize the bridge

\`\`\`bash
cd your-existing-project
aibridge init --agents cursor,claude
\`\`\`

## Step 2: Import existing conventions

If you already have rules in \`.cursorrules\` or \`CLAUDE.md\`, add them as conventions:

\`\`\`bash
aibridge convention set "Your existing rule here" --category workflow
\`\`\`

AiBridge will inject its protocol into your existing agent instruction files without overwriting your custom rules.

## Step 3: Capture current state

Create tasks for any in-flight work:

\`\`\`bash
aibridge task add "Finish user profile page" --assign cursor --priority high
aibridge task add "Refactor database queries" --assign claude --priority medium
\`\`\`

## Step 4: Commit the bridge

\`\`\`bash
git add .aibridge/
git commit -m "feat: initialize AiBridge coordination layer"
\`\`\`

## What changes in your workflow?

- Agents now read \`CONTEXT.md\` first → they know what's happening.
- Switching agents includes a handoff → no more re-explaining.
- Decisions are recorded → no more contradictory choices.`,
  },
  // ── FAQ ──
  {
    id: "faq",
    title: "Frequently Asked Questions",
    category: "faq",
    keywords: ["faq", "questions", "help", "troubleshoot"],
    content: `# FAQ

## General

**Q: Does AiBridge modify my source code?**
No. AiBridge only reads and writes files in the \`.aibridge/\` directory and agent instruction files (\`.cursorrules\`, \`CLAUDE.md\`, etc.). Your source code is never touched.

**Q: Do I need a cloud account?**
No. AiBridge is local-first. Everything works with just files on disk. Cloud sync is optional and planned for a future release.

**Q: Which AI tools are supported?**
Cursor, Claude Code (Anthropic), OpenAI Codex, Windsurf, GitHub Copilot, and any custom tool that can read Markdown files.

**Q: Is it free?**
The CLI and local runtime are open source and free. The hosted dashboard and cloud sync will have a free tier with paid plans for teams.

## Technical

**Q: How does CONTEXT.md stay up to date?**
It's regenerated automatically after every state mutation (task changes, messages, handoffs, etc.) by the CLI or local service.

**Q: Can agents write to .aibridge/ directly?**
Agents should **read** \`.aibridge/\` freely, but canonical mutations should go through the CLI/runtime or local service. Manual JSON edits can be flagged as protocol issues in the dashboard.

**Q: What if two agents edit the same file?**
AiBridge uses stable IDs and the \`ownedPaths\` mechanism to reduce conflicts. Git merge handles the rest. True conflict resolution is planned for the cloud sync layer.

**Q: Does it work with monorepos?**
Yes. Each package/app can have its own \`.aibridge/\` directory, or you can use a single bridge at the monorepo root.

## Troubleshooting

**Q: The dashboard shows "No data"**
Make sure the local service is running (\`aibridge serve\`) and pointing to the right bridge directory.

**Q: CONTEXT.md is stale**
Run \`aibridge context generate\` or \`POST /bridge/context/generate\` to force regeneration.

**Q: Agent doesn't see my conventions**
Check that the agent's instruction file includes "Read CONTEXT.md first" — this is added automatically by \`aibridge init\`.`,
  },
];
