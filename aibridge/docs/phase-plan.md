# AiBridge Phase Plan

Status in this repo as of March 9, 2026.

## Phase 0 - Protocol Definition

- [x] JSON schemas for bridge config, tasks, logs, handoffs, decisions, messages, and conventions
- [x] Example bridge scaffold and agent templates
- [x] Context compiler spec

## Phase 1 - Local Runtime + CLI

- [x] Filesystem-backed `.aibridge/` runtime
- [x] Deterministic `CONTEXT.md` generation
- [x] `aibridge init`
- [x] `aibridge status`
- [x] `aibridge task add|list|update|assign|in-progress|done`
- [x] `aibridge message add|list|ack`
- [x] `aibridge handoff create|list`
- [x] `aibridge decision add|accept|supersede|list`
- [x] `aibridge convention set|add|show|list|sync`
- [x] `aibridge log add|list`
- [x] `aibridge context generate`
- [x] `aibridge serve`
- [x] `aibridge sync` stub

## Phase 2 - Standalone Local Service

- [x] Standalone local HTTP service extracted from Vite
- [x] Vite plugin reduced to a thin service bootstrapper
- [x] Dashboard local mode reads through the standalone service
- [x] Local dashboard route available without Supabase auth (`/dashboard`)
- [x] SSE-based bridge change notifications for dashboard refresh
- [x] Bundled sample bridge dataset for local/demo workflows
- [x] Bridge-level write coordination for concurrent local mutations
- [x] Verified service attach behavior for port reuse and workspace identity

## Phase 3 - Capture

- [x] Capture spec documented
- [x] Git hook installation and attribution
- [x] Debounced local watcher with persisted capture status
- [x] Capture validation warnings that keep the bridge resilient
- [x] Dashboard/service visibility for capture state
- [x] Explicit watcher lifecycle (`watch`, `status`, `stop`) for Local V1

## Phase 4 - Sync

- [x] Sync spec documented
- [ ] Real push/pull protocol
- [ ] Conflict resolution and merge model
- [ ] Remote sync service

## Phase 5 - Dashboard Productization

- [x] Dashboard shell and views
- [x] Demo/local data switching
- [x] Overview, activity feed, tasks, messages, conventions, decisions, agents, settings
- [ ] Expanded write surfaces beyond task/message actions
- [ ] More component-level and end-to-end coverage

## Phase 6 - Hosted / Team Features

- [x] Auth isolated to hosted route experiments (`/app`), not required for Local V1
- [x] Hosted control plane foundation for project registry, platform-wide product updates, platform-wide product notices, and admin/owner controls
- [x] Local bridge linkage metadata on hosted projects without syncing `.aibridge` runtime state
- [ ] Hosted UI surfaces for project switching and admin management
- [ ] Full cloud sync of `.aibridge` runtime entities
- [ ] Team activity history and collaboration workflows
- [ ] Paid sync and management features

## Phase 7 - Setup / Onboarding Foundation

- [x] Shared setup domain model (`SetupTemplate`, questionnaire, preferences, generated plan, setup result)
- [x] Data-driven template library (`web-app`, `api-backend`, `mobile-app`, `landing-page`, `ai-automation`, `research-docs`, `empty`)
- [x] Setup generator for starter roles, tasks, conventions, definition of done, and workflow guidance
- [x] Local bridge initialization from generated setup using the canonical runtime/store path
- [x] Hosted project metadata payload generation for `/app` project creation
- [x] Local service setup endpoints for future UI use
- [x] CLI parity for `setup plan` and template-driven `init`
- [ ] Guided UI onboarding flows in `/app`
- [ ] Lightweight setup launcher UI in `/dashboard`
