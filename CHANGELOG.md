# Changelog

All notable changes to this project will be documented in this file.

## 0.1.15 — 2026-03-15

### Fixed
- **Packaged dashboard auto-port selection** — `aibridge dashboard` now auto-pairs dashboard ports `8780-8787` with service ports `4545-4552`, so multiple AiBridge workspaces can run side by side without manual `--service-port` overrides.
- **Background launcher failure reporting** — when the detached packaged dashboard fails before becoming healthy, the CLI now fails fast with a clear error instead of appearing stuck.
- **Dashboard docs** — the packaged workflow docs now describe the automatic port scanning and the `--port` / `--service-port` escape hatch accurately.

## 0.1.14 — 2026-03-15

### Added
- **Concrete agent adapters** — AiBridge now models `cursor`, `antigravity`, and `codex` through a shared adapter layer with explicit launch modes, dispatch status, attached context files, and command previews.
- **UI-first launch and recovery dispatch** — the local dashboard can now show dispatch-ready launch/recovery actions instead of only raw prompt text.
- **Protocol issue workflow** — invalid hand-written `.aibridge/*.json` files are surfaced as structured protocol issues with cleanup and repair-prompt endpoints.
- **Prompt artifacts** — launch and recovery prompts are now written to `.aibridge/prompts/` for inspection and future tool execution paths.
- **Inbox-first operator controls** — the dashboard now exposes message acknowledgement, handoff accept/resolve actions, inline decision recording, operator logs, and context regeneration without requiring terminal use.
- **Packaged dashboard launcher** — `aibridge dashboard` now starts or attaches to a background dashboard process, ensures the local service is running, and opens the browser for the current workspace.

### Changed
- **Agent Launch Center** now distinguishes prompt-copy, Antigravity UI dispatch, and Codex non-chat execution paths.
- **Status payloads** now include adapter capabilities and structured protocol issues so the UI can guide humans without dropping to CLI-first troubleshooting.
- **Recovery flow** now carries tool-specific attach-file hints and command previews.
- **Open handoffs** now have an explicit lifecycle (`open`, `accepted`, `completed`) that is reflected in runtime state and dashboard actions.
- **Dashboard ownership** is more explicit: humans operate primarily from `/dashboard`, while agents still use the CLI/runtime as the canonical mutation layer.

### Fixed
- **Stale-session noise** — context-change staleness now waits through a short grace window before marking a session stale during normal coordination bursts.
- **Context/session drift** — context generation now derives session health from the same runtime rules used by status so the dashboard and generated context stay aligned more often.
- **Human repair fallback** — when an agent fails to complete coordination state, operators can now finish recovery from the dashboard instead of dropping to raw CLI commands.
- **Packaged asset delivery** — the npm package now includes the built dashboard bundle so the packaged launcher can serve the UI directly.

## 0.1.12 — 2026-03-14

### Changed
- Dashboard + runtime updates (agents/inbox/session surfaces) and docs refresh.

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
