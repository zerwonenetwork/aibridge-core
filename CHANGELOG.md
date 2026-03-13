# Changelog

All notable changes to this project will be documented in this file.

## 0.1.4 — 2026-03-13

### Changed
- npm publish workflow: Trusted Publisher (OIDC) for releases.
- Route-based code splitting to reduce dashboard bundle size.
- SECURITY.md and publishing docs updated; GitHub repo links to zerwonenetwork/aibridge-core.

## 0.1.0 — 2026-03-12

### Added
- Public open-core repo split: **local-first** CLI + runtime + local service + dashboard.
- Setup engine + onboarding wizard for local initialization.
- Capture subsystem (git hooks + watcher) + agent sessions.
- Examples directory with reference workflows.

### Removed
- Hosted/auth surfaces: Supabase, hosted routes, hosted dashboard views, hosted control plane.

### Notes
- This is the first public-core release cut from the internal product repository.
