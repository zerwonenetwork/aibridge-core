## Contributing

Thanks for helping improve **AiBridge Core**.

### Ground rules

- **Local-first only**: this repo intentionally does not include hosted auth/control-plane code.
- **No secrets**: never commit `.env`, keys, tokens, or private URLs.
- **Keep the CLI/runtime stable**: breaking CLI semantics should be discussed first.

### Development setup

```bash
npm install
npm run dev
```

### Quality gates

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

### Project areas

- `aibridge/cli/` — CLI command surface and formatting
- `aibridge/services/local/` — local HTTP/SSE service
- `aibridge/services/capture/` — capture hooks and file watcher
- `aibridge/setup/` — setup templates + plan generator
- `src/` — dashboard reference UI

### Submitting changes

1. Keep PRs small and focused.
2. Include a short test plan.
3. Update docs if behavior changes.

### Reporting security issues

Please do **not** file public issues for sensitive vulnerabilities. Instead, open a private report with maintainers.
