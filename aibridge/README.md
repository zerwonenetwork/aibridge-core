# AiBridge Implementation Structure

This folder is the implementation workspace for **AiBridge's Local V1 stack** based on `AiBridge-Product-Definition.docx` (source of truth).

## Ownership split

- **UI Layer:** dashboard routes, components, visual states, interactions.
- **Core Layer (this folder):** protocol, capture layer, backend API, sync engine, CLI contracts, and integration surfaces.

## Folder layout

- `protocol/` — file formats and schemas for `.aibridge/`.
- `cli/` — CLI command architecture and command contracts.
- `services/capture/` — git hook attribution and file watcher capture specs.
- `services/sync/` — cloud/device sync engine specs.
- `services/api/` — dashboard/backend API contracts and service boundaries.
- `context/` — context generation algorithm notes for `CONTEXT.md`.
- `docs/` — implementation plans and phase tracking.

## Current reality

Implemented here today:

1. protocol schemas and templates for `.aibridge/`,
2. filesystem-backed local runtime and deterministic `CONTEXT.md` generation,
3. standalone local HTTP/SSE service for dashboard + future tooling reuse, with verified attach semantics for existing local services,
4. executable TypeScript CLI for local bridge workflows,
5. local auto-capture via git hooks, watcher batching, explicit watcher stop/status, and validation warnings.

Still planned later:

1. real sync,
2. hosted/team features.

The primary Local V1 stack is now:

- `.aibridge/` protocol files as the shared source of truth,
- `aibridge/runtime/` as the canonical parser/store/compiler layer,
- `aibridge/services/local/` as the reusable local service boundary,
- `aibridge/services/capture/` as the local auto-capture layer,
- `aibridge/cli/` as the local command surface.
