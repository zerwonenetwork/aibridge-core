# Test checklist: AiBridge Core on a new project

Use this when verifying the published package `@zerwonenetwork/aibridge-core` on a fresh project.

---

## Prerequisites

- [ ] Node.js 18+
- [ ] New or empty project folder (or a real repo you want to try AiBridge in)

---

## 1. Install CLI globally

```bash
npm i -g @zerwonenetwork/aibridge-core
```

- [ ] Command completes without error
- [ ] `aibridge --help` prints usage and command list

---

## 2. Init a bridge (pick one)

**Option A — Interactive**

```bash
cd /path/to/your/project
aibridge init --interactive
```

- [ ] Prompts run (name, description, agents, etc.)
- [ ] `.aibridge/` is created with `bridge.json`, `agents/`, `tasks/`, etc.

**Option B — Template**

```bash
aibridge init --template web-app --name "Test Project" --description "Quick test" --stack react,typescript --multi-agent
```

- [ ] No errors
- [ ] `.aibridge/` exists with expected structure

**Option C — Minimal**

```bash
aibridge init --name "Test Project" --agents cursor,codex
```

- [ ] Bridge created

---

## 3. CLI commands

- [ ] `aibridge status` — shows bridge and service status
- [ ] `aibridge task add "My first task" --assign cursor` — adds a task
- [ ] `aibridge task list` — lists tasks
- [ ] `aibridge message add "Test message" --from cursor --to codex` — adds a message
- [ ] `aibridge context generate` — generates/updates `CONTEXT.md` in `.aibridge/`

---

## 4. Local service

In the project directory:

```bash
aibridge serve
```

(Or from the aibridge-core repo: `npm run aibridge:service`)

- [ ] Service starts (e.g. `http://127.0.0.1:4545`)
- [ ] `curl http://127.0.0.1:4545/health` returns OK
- [ ] `curl http://127.0.0.1:4545/bridge/status` returns bridge data (with bridge root in that project)

---

## 5. Dashboard (from aibridge-core repo)

From the **aibridge-core** repo (so the dashboard app is available):

```bash
cd path/to/aibridge-core
npm run dev
```

- [ ] Dev server starts (e.g. `http://localhost:8080`)
- [ ] Open `http://localhost:8080/dashboard`
- [ ] Dashboard loads; if no bridge in aibridge-core, use “Open sample” or point to the test project’s `.aibridge` (if the dashboard supports it)
- [ ] Alternatively: run `npm run dev` inside a **clone of aibridge-core** and open dashboard; ensure the local service is running against a project that has `.aibridge` and is on the same machine so the dashboard can discover it (depends on how the dashboard resolves the bridge)

**Simplest:** In the **test project**, run `aibridge serve`. In **aibridge-core** clone, run `npm run dev` and open `/dashboard`. If the dashboard is configured to talk to `127.0.0.1:4545`, it should show the test project’s bridge when the service is running from that project.

- [ ] Overview / Tasks / Messages (or similar) show data when the service has a bridge

---

## 6. Capture (optional)

In the test project:

```bash
aibridge capture install-hooks
aibridge capture status
```

- [ ] Hooks install (or message that repo is not a git repo)
- [ ] `capture status` or `capture doctor` runs without crashing

---

## 7. Agent commands (optional)

```bash
aibridge agent launch --agent cursor --tool cursor
aibridge agent status
```

- [ ] Launch creates a session (or exits with clear message)
- [ ] `agent status` lists sessions or shows “none”

---

## 8. Uninstall (cleanup)

```bash
npm uninstall -g @zerwonenetwork/aibridge-core
```

- [ ] Uninstall succeeds
- [ ] `aibridge` no longer in PATH (or “command not found”)

---

## Quick one-liner test (from empty folder)

```bash
mkdir aibridge-test && cd aibridge-test
npm i -g @zerwonenetwork/aibridge-core
aibridge init --name "Quick Test" --agents cursor
aibridge status
aibridge task add "Checklist task" --assign cursor
aibridge task list
```

- [ ] All commands succeed

---

## Notes

- If the dashboard is used, the **local service** must be running from a directory that has `.aibridge` (your test project), and the dashboard app (from aibridge-core) must be configured to use `http://127.0.0.1:4545` (or the correct port).
- For capture tests, the project should be a git repo (`git init` first if needed).
