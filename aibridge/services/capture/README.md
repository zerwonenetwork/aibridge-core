# Capture Layer Boundary

Capture layer ingests local developer + agent activity into `.aibridge/logs/`:

- Git hook capture for commit / merge / checkout attribution
- Debounced file watcher capture for changed files
- Explicit watcher lifecycle through `aibridge capture watch|status|stop`
- Agent self-log validation warnings under `.aibridge/capture/`

Output is normalized through the existing runtime/store pipeline so hooks, watcher events, CLI writes, and the dashboard all share the same `.aibridge` state.
