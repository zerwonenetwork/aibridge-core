# AiBridge End-to-End Flow Checklist

Use this checklist to test AiBridge like a real user from start to finish.

This file is intentionally practical:
- exact commands
- exact routes
- expected outcomes
- local workspace flow
- hosted control-plane flow
- admin/viewer differences
- realtime checks

## Command note

When testing from a separate repo like `TESTINGREPO`, do **not** use:

```bash
npm run aibridge -- ...
```

from that separate repo. That runs the `aibridge` script from `harmony-hub/package.json`, and npm will also eat flags like `--from`, `--assign`, and `--agents`.

Use the CLI entrypoint directly from the test repo instead:

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts <command>
```

Also note:
- `Workspace .aibridge` in the dashboard resolves relative to the **running local service cwd**
- if your test bridge lives in another repo, use `Custom path` in dashboard settings and point it at that repo's `.aibridge` directory

## 1. Preflight

- [ ] Open a terminal in `d:\Storage\zerwone\AiBridge\harmony-hub`
- [ ] Install dependencies

```bash
npm install
```

- [ ] Verify repo health

```bash
npm run typecheck
npm run test
npm run build
```

- [ ] Start the app

```bash
npm run dev
```

- [ ] Confirm Vite is serving the app
- [ ] Confirm the local AiBridge service is reachable if needed through the app or separately:

```bash
npm run aibridge:service
```

## 2. Local Workspace Flow (`/dashboard`)

### A. Open local dashboard

- [ ] Open `http://127.0.0.1:8080/dashboard`
- [ ] Confirm login is **not** required
- [ ] Confirm the route reads as local workspace, not hosted control plane
- [ ] Confirm there is **no** hosted project switcher
- [ ] Confirm there are **no** releases/product-updates views in the local sidebar
- [ ] Confirm there are **no** announcements/notices views in the local sidebar

### B. Use sample local data

- [ ] Open Settings
- [ ] Set source to `Sample Bridge`
- [ ] Confirm overview, tasks, activity, messages, conventions, decisions, agents load
- [ ] Confirm local bridge notices/errors render reasonably if present

### C. Create a real local bridge

- [ ] In a separate terminal, initialize a bridge in the repo root or a temp repo

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts init --name "Checklist Workspace" --agents cursor,claude,codex
```

- [ ] If the bridge was created outside `harmony-hub`, switch Settings source to `Custom path`
- [ ] Enter the test bridge path, for example:

```text
D:\Storage\zerwone\AiBridge\harmony-hub\TESTINGREPO\.aibridge
```

- [ ] If the bridge was created in `harmony-hub` itself, use `Workspace Bridge`
- [ ] Refresh if needed
- [ ] Confirm the dashboard now reads real `.aibridge` workspace data

### D. Local operational actions

- [ ] Add a task from CLI

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts task add "Run end-to-end checklist" --assign cursor --priority high
```

- [ ] Add a message

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts message add "Checklist in progress" --from cursor --to claude
```

- [ ] Add a handoff

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts handoff create claude "Continue verification" --from cursor
```

- [ ] Add a decision

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts decision add ChecklistFlow "Verified local flow" --status accepted --from cursor
```

- [ ] Add a convention

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts convention set "Keep Local V1 workspace-first" --category workflow --from cursor
```

- [ ] Regenerate context

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts context generate
```

- [ ] Confirm the dashboard updates after refresh or SSE
- [ ] Confirm tasks/messages/handoffs/decisions/conventions reflect the new state
- [ ] Confirm local activity/context remain local-only

## 3. Local Auto-Capture Flow

- [ ] Install hooks

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts capture install-hooks
```

- [ ] Run capture doctor

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts capture doctor
```

- [ ] Start watcher

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts capture watch --agent cursor
```

- [ ] Edit a workspace file
- [ ] Make a real git commit

```bash
git add .
git commit -m "test: checklist capture"
```

- [ ] Confirm capture status updates
- [ ] Confirm new activity appears in the local dashboard
- [ ] Confirm context regenerates

- [ ] Stop watcher cleanly

```bash
npx tsx ..\aibridge\cli\bin\aibridge.ts capture stop
```

- [ ] Confirm watcher status reports `running: false`

## 4. Hosted Control Plane Flow (`/app`)

### A. Sign in

- [ ] Open `http://127.0.0.1:8080/app`
- [ ] Confirm unauthenticated access redirects to login
- [ ] Sign in with a real hosted account
- [ ] Confirm `/app` loads successfully

### B. Confirm hosted workspace shell

- [ ] Confirm hosted workspace switcher is visible
- [ ] Confirm the switcher is labeled as `Workspace`
- [ ] Confirm helper text makes it clear workspace switching does not change global product feeds
- [ ] Confirm local operational views still exist
- [ ] Confirm hosted communication views exist:
  - [ ] `Product Updates`
  - [ ] `Notices`

### C. Global Product Updates

- [ ] Open `Product Updates`
- [ ] Confirm updates are global, not labeled as project-specific
- [ ] If signed in as admin, create a new product update
- [ ] Publish it
- [ ] Confirm it appears regardless of which workspace is selected

### D. Global Notices

- [ ] Open `Notices`
- [ ] Confirm notices are global, not project-specific
- [ ] If signed in as admin, create a new notice
- [ ] Publish or pin it
- [ ] Confirm it appears regardless of which workspace is selected

## 5. Workspace Switching Behavior

- [ ] Select workspace A
- [ ] Record:
  - [ ] current workspace name
  - [ ] product updates visible
  - [ ] notices visible
- [ ] Select workspace B
- [ ] Confirm workspace context changes
- [ ] Confirm local operational context in the hosted shell stays tied to the selected workspace context as designed
- [ ] Confirm global product updates do **not** change
- [ ] Confirm global notices do **not** change

## 6. Role Checks

### Admin

- [ ] Sign in as admin
- [ ] Confirm admin can:
  - [ ] create/edit/publish/archive global product updates
  - [ ] create/edit/publish/pin/archive global notices
  - [ ] manage hosted workspaces/projects

### Viewer / Non-admin

- [ ] Sign in as non-admin
- [ ] Confirm viewer can:
  - [ ] read visible workspaces
  - [ ] read published product updates
  - [ ] read published/pinned notices
- [ ] Confirm viewer cannot:
  - [ ] create product updates
  - [ ] edit or publish product updates
  - [ ] create notices
  - [ ] pin/archive notices

## 7. Realtime Checks

### Hosted realtime

- [ ] Keep `/app` open in one browser window
- [ ] In another window or account, change hosted data:
  - [ ] create or edit a workspace
  - [ ] create/edit/publish a product update
  - [ ] create/edit/publish/pin a notice
- [ ] Confirm the first window updates without a full reload

### Local realtime

- [ ] Keep `/dashboard` open
- [ ] Change `.aibridge` state from CLI
- [ ] Confirm the local dashboard refreshes through local bridge events

## 8. Regression Checks

- [ ] `/dashboard` still does not require login
- [ ] `/dashboard` still does not show hosted communication views
- [ ] `/app` still requires login
- [ ] `/app` still shows hosted workspace switching
- [ ] Local tasks/messages/handoffs/decisions/conventions/logs/context are still not cloud-synced
- [ ] Hosted product updates and notices are still global

## 9. Signoff

Mark this release ready only if all are true:

- [ ] Local workspace flow works
- [ ] Local auto-capture works
- [ ] Hosted sign-in flow works
- [ ] Hosted workspace switching works
- [ ] Product updates are global
- [ ] Notices are global
- [ ] Viewer/admin permissions work
- [ ] Hosted realtime works
- [ ] Local realtime works
- [ ] No route or copy still implies project-specific product updates/notices
