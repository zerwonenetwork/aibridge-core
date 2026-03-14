# Changelog

All notable changes to this project will be documented in this file.

## 0.1.11 — 2026-03-14

### Fixed
- **Capture hooks with global install** — When using the published package (`aibridge` from npm), `TOOL_ROOT` is now correct and git hooks call the global `aibridge` instead of requiring tsx. `aibridge capture doctor` no longer fails on "tsx not found" when using the global CLI; it reports "Using global aibridge for hooks (tsx not required)". Re-run `aibridge capture install-hooks` after updating to refresh hook scripts.

## 0.1.10 — 2026-03-14

### Fixed
- **Postinstall output** — Use `scripts/postinstall.mjs` instead of inline script so install-step text always shows (fixes missing output on Windows and in CI).

## 0.1.9 — 2026-03-08

### Added
- **Postinstall steps** — Install/update now prints step status: setup protocol templates, register CLI binary, post-install checks.
- **Update-available warning** — CLI checks npm for a newer version (cached 12h); prints a one-line hint when an update is available.

## 0.1.8 — 2026-03-08

### Added
- **`aibridge --version` / `aibridge -v`** — Print CLI version and exit (no longer shows full help).
- **Postinstall message** — After `npm install -g` or `npm update -g`, print installed version and hint to run `aibridge --version`.

## 0.1.7 — 2026-03-08

### Added
- **`aibridge agent add <agent-id>`** — Add an agent to an existing bridge from the CLI (e.g. `aibridge agent add antigravity`). Creates the agent entry in `bridge.json` and the `.aibridge/agents/<agent-id>.md` file from the built-in template. Supported ids: `cursor`, `claude`, `codex`, `antigravity`, `copilot`, `windsurf`, `custom`.

## 0.1.6 — 2026-03-13

### Changed
- No code changes; release to verify npm Trusted Publisher (CI) publish flow.

## 0.1.5 — 2026-03-13

### Changed
- **Package scope**: published as `@zerwonenetwork/aibridge-core` (was `@zerwone/aibridge-core`). Install with `npm i -g @zerwonenetwork/aibridge-core`. The old package is deprecated in favor of this one.

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
