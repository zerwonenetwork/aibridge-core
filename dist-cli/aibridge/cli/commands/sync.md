# `aibridge sync`

## Synopsis

```
aibridge sync [--push] [--pull] [--force]
```

## Description

Synchronizes local `.aibridge/` state with the cloud. Default behavior is bidirectional (push local changes, pull remote changes).

## Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--push` | boolean | `false` | Push-only mode |
| `--pull` | boolean | `false` | Pull-only mode |
| `--force` | boolean | `false` | Overwrite conflicts with local state |

If neither `--push` nor `--pull` is specified, performs bidirectional sync.

## Behavior

1. **Detect local changes** since last sync (compare file hashes against `.aibridge/.sync-state.json`).
2. **Push local changes** to cloud API.
3. **Pull remote changes** from cloud API.
4. **Merge** using per-entity-type conflict resolution (see Sync Spec).
5. **Update `.aibridge/.sync-state.json`** with new hashes and timestamp.
6. **Regenerate `CONTEXT.md`** to reflect merged state.

## Conflict Resolution

See `aibridge/services/sync/spec.md` for detailed merge strategy per entity type.

## Files Read/Written

- All files in `.aibridge/` — read for change detection
- `.aibridge/.sync-state.json` — internal sync metadata
- `.aibridge/CONTEXT.md` — regenerated after sync

## Exit Codes

- `0` — Success, no conflicts
- `0` — Success, conflicts auto-resolved
- `1` — Sync failed (network error, auth error)
- `2` — Unresolvable conflicts (requires `--force`)
