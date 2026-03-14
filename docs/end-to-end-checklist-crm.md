# End-to-End Checklist on CRM Project

Run this on **D:\Storage\zerwone\testing\crm** with the **published** CLI (`aibridge` or `npx @zerwonenetwork/aibridge-core`).  
Open-core only: local dashboard + local service, no hosted `/app`.

---

## 1. Preflight

- [ ] Terminal in **aibridge-core** repo: `D:\Storage\zerwone\AiBridge\aibridge-core`
- [ ] Install and build:
  ```bash
  npm install
  npm run typecheck
  npm run test
  npm run build
  ```
- [ ] Start the **dashboard** (from aibridge-core):
  ```bash
  npm run dev
  ```
- [ ] Confirm Vite serves the app (e.g. http://127.0.0.1:5173)
- [ ] In **another terminal**, start the **local AiBridge service** (so dashboard can read a bridge):
  ```bash
  cd D:\Storage\zerwone\AiBridge\aibridge-core
  npm run aibridge:service
  ```
  (Or run the service with cwd = CRM so it serves the CRM bridge; see step 2.)

---

## 2. Local Workspace Flow (`/dashboard`)

### A. Open local dashboard

- [ ] Open **http://127.0.0.1:5173/dashboard** (or the port Vite shows)
- [ ] No login required
- [ ] UI reads as **local workspace** (no hosted project switcher, no Product Updates / Notices in sidebar)

### B. Point dashboard at CRM bridge

- [ ] In dashboard: **Settings**
- [ ] If the service was started from **aibridge-core** root: set source to **Custom path**
- [ ] Set path to:
  ```text
  D:\Storage\zerwone\testing\crm\.aibridge
  ```
- [ ] If you started the local service with cwd = **CRM** (`cd D:\Storage\zerwone\testing\crm` then `aibridge serve`), use **Workspace Bridge** and ensure the service is running from the CRM dir.
- [ ] Refresh if needed
- [ ] Confirm overview, tasks, activity, messages, conventions, decisions, agents load for ContactBridge

### C. CLI from CRM (use published CLI)

From a terminal in **D:\Storage\zerwone\testing\crm** run (use `aibridge` if in PATH, else `npx @zerwonenetwork/aibridge-core`):

- [ ] Add a task:
  ```bash
  aibridge task add "Run end-to-end checklist" --assign cursor --priority high
  ```
- [ ] Add a message:
  ```bash
  aibridge message add "Checklist in progress" --from cursor --to claude
  ```
- [ ] Add a handoff:
  ```bash
  aibridge handoff create claude "Continue verification" --from cursor
  ```
- [ ] Add a decision:
  ```bash
  aibridge decision add ChecklistFlow "Verified local flow" --status accepted --from cursor
  ```
- [ ] Add a convention:
  ```bash
  aibridge convention set "Keep Local V1 workspace-first" --category workflow --from cursor
  ```
- [ ] Regenerate context:
  ```bash
  aibridge context generate
  ```
- [ ] In dashboard: refresh or wait for SSE; confirm tasks, messages, handoffs, decisions, conventions show the new state

---

## 3. Local Auto-Capture Flow

From **D:\Storage\zerwone\testing\crm**:

- [ ] Install hooks:
  ```bash
  aibridge capture install-hooks
  ```
- [ ] Run doctor:
  ```bash
  aibridge capture doctor
  ```
  (Expect post-commit hook and status.)
- [ ] Start watcher:
  ```bash
  aibridge capture watch --agent cursor
  ```
- [ ] Edit a file in the CRM repo (e.g. add a comment in a source file), save
- [ ] Commit:
  ```bash
  git add .
  git commit -m "test: checklist capture"
  ```
- [ ] Check capture status:
  ```bash
  aibridge capture status
  ```
- [ ] In dashboard: confirm new activity and that context regenerated
- [ ] Stop watcher:
  ```bash
  aibridge capture stop
  ```
- [ ] Confirm status shows watcher stopped

---

## 4. Local Realtime Check

- [ ] Keep **/dashboard** open in the browser
- [ ] From CLI (in CRM): e.g. `aibridge task add "Realtime test" --assign cursor`
- [ ] Confirm the dashboard updates (SSE or refresh) without full reload

---

## 5. Regression (Local-Only)

- [ ] `/dashboard` does not require login
- [ ] `/dashboard` does not show Product Updates / Notices (hosted views)
- [ ] Tasks, messages, handoffs, decisions, conventions, context stay local (no cloud sync)

---

## 6. Signoff (Open-Core)

- [ ] Local workspace flow works (dashboard + CLI on CRM)
- [ ] Local auto-capture works (hooks, doctor, watch, commit, context)
- [ ] Local realtime works (CLI change visible in dashboard)
- [ ] No hosted routes or copy in the build you tested
