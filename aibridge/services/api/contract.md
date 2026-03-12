# AiBridge Service Contract

This file reflects the **implemented service boundaries** in this repo:

- the local-first bridge service in `aibridge/services/local/service.ts`
- the hosted control-plane data layer in `src/lib/aibridge/hosted/`

Important product boundary:
- Local `.aibridge` files remain the source of truth for runtime activity.
- The hosted control plane currently manages project registry, platform-wide product updates, platform-wide product notices, and admin/owner access.
- Full cloud sync of tasks/messages/handoffs/decisions/conventions/logs/capture is **not** implemented.

## Current Implemented Service

- Default base URL: `http://127.0.0.1:4545`
- Transport: HTTP + Server-Sent Events
- Auth: none for local mode
- Source of truth: files under `.aibridge/`

## Implemented Endpoints

### Health

- `GET /health`

### Status + Context

- `GET /bridge/status`
- `POST /bridge/context/generate`

### Setup

- `GET /bridge/setup/templates`
- `POST /bridge/setup/plan`
- `POST /bridge/setup/init`

### Tasks

- `GET /bridge/tasks`
- `POST /bridge/tasks`
- `PATCH /bridge/tasks/:id`

### Messages

- `GET /bridge/messages`
- `POST /bridge/messages`
- `PATCH /bridge/messages/:id/ack`

### Handoffs

- `GET /bridge/handoffs`
- `POST /bridge/handoffs`

### Decisions

- `GET /bridge/decisions`
- `POST /bridge/decisions`
- `PATCH /bridge/decisions/:id`

### Conventions

- `GET /bridge/conventions`
- `POST /bridge/conventions`

Query option:
- `format=markdown` returns the rendered `CONVENTIONS.md` body.

### Logs

- `GET /bridge/logs`
- `POST /bridge/logs`

### Change Stream

- `GET /bridge/events`

SSE events currently emitted:
- `ready`
- `bridge.changed`

## Runtime Selection

Every bridge endpoint can target a runtime source with:

- `source=sample`
- `source=workspace`
- `source=custom&root=<path>`

The browser dashboard uses this to switch between demo data, bundled sample data, workspace `.aibridge`, and a custom bridge root.

## Envelope Shape

Most mutation endpoints return:

```json
{
  "data": {},
  "status": {},
  "runtime": {},
  "revision": "..."
}
```

Read endpoints return:

```json
{
  "data": {},
  "runtime": {},
  "revision": "..."
}
```

Setup endpoints currently return:

```json
{
  "data": {
    "result": {},
    "markdown": "..."
  },
  "status": {},
  "runtime": {},
  "revision": "..."
}
```

## Hosted Control Plane Boundary

The hosted/shared layer is implemented through Supabase schema, RLS, and a typed client-service stack:

- `src/lib/aibridge/hosted/types.ts`
- `src/lib/aibridge/hosted/service.ts`
- `src/lib/aibridge/hosted/client.ts`
- `supabase/migrations/20260309121000_hosted_control_plane.sql`

Canonical hosted resources:

- `projects`
- `releases`
- `announcements`

Hosted projects now also store setup/onboarding metadata:

- `setup_template`
- `setup_brief`
- `setup_preferences`
- `setup_plan`
- `initialized_at`

Conceptual hosted API routes for future UI/API parity:

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `POST /projects/:id/archive`
- `GET /releases`
- `POST /releases`
- `GET /releases/:releaseId`
- `PATCH /releases/:releaseId`
- `POST /releases/:releaseId/publish`
- `POST /releases/:releaseId/archive`
- `GET /announcements`
- `GET /announcements/:announcementId`
- `PATCH /announcements/:announcementId`
- `POST /announcements/:announcementId/publish`
- `POST /announcements/:announcementId/pin`
- `POST /announcements/:announcementId/unpin`
- `POST /announcements/:announcementId/archive`

Current implementation note:
- These hosted routes are represented today by the typed client/service layer, not by a separate standalone HTTP server.
- Supabase row-level security is the enforcement boundary for admin/owner mutation and published-only reads.
- In the main product flow, releases are surfaced as global AiBridge product updates and announcements are surfaced as global AiBridge notices.
- The same shared setup engine drives hosted project creation metadata, local bridge initialization, and CLI setup planning.

## Planned Later

Future work can extend the local and hosted boundaries with:

- auth
- sync endpoints
- conflict handling
- richer event payloads
- hosted HTTP façade if needed beyond the current Supabase-backed client layer
