# Start over: remove and redo the CRM project

Use this to wipe the bridge (or the whole project) and run the full flow again.

---

## 1. Remove the project (pick one)

**Option A — Remove only the bridge (keep the folder and any code)**

From the project folder (e.g. `D:\Storage\zerwone\testing\crm`):

```bash
# Windows PowerShell
Remove-Item -Recurse -Force .aibridge

# Or Bash / CMD
rm -rf .aibridge
```

The folder stays; only `.aibridge` is gone. You can run `aibridge init` again in the same folder.

**Option B — Remove the whole project folder**

Delete the folder (e.g. `D:\Storage\zerwone\testing\crm`) from Explorer or:

```bash
# From parent folder
Remove-Item -Recurse -Force D:\Storage\zerwone\testing\crm
```

Then create a new folder and `cd` into it for the steps below.

---

## 2. Redo everything (from scratch)

**2.1 Create project and init bridge**

```bash
mkdir D:\Storage\zerwone\testing\crm
cd D:\Storage\zerwone\testing\crm
git init
npm i -g @zerwonenetwork/aibridge-core
aibridge init --template web-app --name "ContactBridge" --description "Small CRM with contacts, deals, activity" --stack react,typescript,node --multi-agent
```

**Important:** Run `git init` before or right after creating the folder. Capture hooks need a `.git` directory; without it, `aibridge capture install-hooks` will fail.

**2.2 Add Antigravity (optional)**

```bash
aibridge agent add antigravity
```

**2.3 Decisions and conventions**

```bash
aibridge decision add "Use Supabase for auth and Postgres; React + TypeScript for frontend" --status accepted --from cursor
aibridge decision add "Deal stages: Lead, Qualified, Proposal, Negotiation, Won, Lost" --status accepted --from cursor
aibridge convention set "API routes under /api/contacts and /api/deals; REST style" --category workflow --from cursor
aibridge convention set "Frontend: React Query for server state, components under src/components" --category workflow --from cursor
```

**2.4 Capture (hooks + doctor)**

```bash
aibridge capture install-hooks
aibridge capture doctor
```

**2.5 Context and prompts**

```bash
aibridge context generate
```

**Prompt each agent directly in their chat.** Either:

- **Option A:** Run `aibridge agent launch --agent cursor --tool cursor`, copy the output, and paste it into **Cursor** chat. Then run `aibridge agent launch --agent antigravity --tool cursor`, copy the output, and paste into **Antigravity** chat.
- **Option B:** Copy the ready-made prompts from `docs/agent-prompts-to-send.md` (Cursor block into Cursor, Antigravity block into Antigravity).

**2.6 Dashboard and local service (optional)**

- From **aibridge-core** repo: `npm run dev` → open http://127.0.0.1:5173/dashboard  
- In **another terminal** from the CRM folder: `aibridge serve`  
- In dashboard **Settings** → **Custom path** → `D:\Storage\zerwone\testing\crm\.aibridge`

---

## 3. Quick reference

| Step            | Command |
|-----------------|--------|
| Remove bridge   | `Remove-Item -Recurse -Force .aibridge` |
| Init            | `aibridge init --template web-app --name "ContactBridge" --description "Small CRM with contacts, deals, activity" --stack react,typescript,node --multi-agent` |
| Add agent       | `aibridge agent add antigravity` |
| Capture         | `aibridge capture install-hooks` then `aibridge capture doctor` |
| Context         | `aibridge context generate` |
| Agent prompts   | Run `aibridge agent launch --agent <name> --tool cursor` and paste output into that agent’s chat, or use `docs/agent-prompts-to-send.md` |
