# Sync Layer Specification

## Purpose

Synchronize local `.aibridge/` state across devices and team members via a cloud service, enabling multi-device and multi-developer coordination.

## Sync Flow

### Push (local → cloud)

1. **Detect changes**: Compare file hashes in `.aibridge/` against `.aibridge/.sync-state.json`.
2. **Serialize changeset**: Collect modified files with their content and metadata.
3. **Encrypt**: Encrypt changeset using project encryption key (AES-256-GCM).
4. **Upload**: POST changeset to `POST /sync/push` API endpoint.
5. **Update sync state**: Store new file hashes and push timestamp.

### Pull (cloud → local)

1. **Request changes**: `GET /sync/pull?since={lastSyncTimestamp}`.
2. **Decrypt**: Decrypt received changeset.
3. **Merge**: Apply per-entity-type merge strategy.
4. **Write**: Write merged files to `.aibridge/`.
5. **Update sync state**: Store new hashes and pull timestamp.

## Sync State File

`.aibridge/.sync-state.json` (not synced, local only):

```json
{
  "lastPushAt": "2025-01-15T12:00:00Z",
  "lastPullAt": "2025-01-15T12:00:00Z",
  "fileHashes": {
    "tasks/abc.json": "sha256:...",
    "logs/cursor.jsonl": "sha256:...",
    "bridge.json": "sha256:..."
  }
}
```

## Conflict Resolution — Per Entity Type

### Tasks (`tasks/*.json`)

**Strategy**: Last-write-wins by `updatedAt` timestamp.

- If both local and remote modified the same task, keep the one with the later `updatedAt`.
- If timestamps are identical, prefer remote (cloud is source of truth).

### Logs (`logs/*.jsonl`)

**Strategy**: Append-only merge.

- Log entries are append-only. Merge by combining both sets and deduplicating by `id`.
- Sort by timestamp after merge.
- Logs are never deleted or modified, only appended.

### Handoffs (`handoffs/*.json`)

**Strategy**: No conflict. Handoffs are immutable after creation.

- New handoffs from either side are simply added.
- If the same ID exists on both sides (shouldn't happen with UUIDs), prefer remote.

### Decisions (`decisions/*.json`)

**Strategy**: Last-write-wins by `timestamp`.

- Status transitions take precedence: `proposed` → `accepted` → `superseded`.
- If both sides propose the same ID, keep the one with the later timestamp.

### Messages (`messages/*.json`)

**Strategy**: Merge with acknowledgment precedence.

- If a message exists on both sides, merge: if either side has `acknowledged: true`, the merged result is `acknowledged: true`.
- New messages from either side are added.

### Conventions (`CONVENTIONS.md` + `conventions/*.json`)

**Strategy**: Union merge.

- Add all conventions from both sides. Deduplicate by `id`.
- Deletions: If a convention was deleted locally but exists remotely, it remains deleted (deletion wins).

### Bridge Config (`bridge.json`)

**Strategy**: Remote wins for schema version. Agent list is unioned.

- New agents from either side are added.
- Conflicting agent metadata: remote wins.

## Encryption

- **Algorithm**: AES-256-GCM
- **Key derivation**: PBKDF2 from project secret + salt
- **Project secret**: Stored in user's OS keychain, never in `.aibridge/`
- **Encrypted in transit and at rest**: All sync payloads are encrypted before leaving the device

## Integrity

- Each file includes a SHA-256 hash in the sync state.
- After pull, verify all written files match their expected hashes.
- On mismatch, reject the pull and report an integrity error.

## Rate Limiting

- Auto-sync interval: minimum 30 seconds between syncs.
- Manual sync (`aibridge sync`): no rate limit.
- File watcher debounce: 5 seconds before triggering auto-sync.

## Offline Support

- All operations work offline against local `.aibridge/`.
- Changes queue for push when connectivity resumes.
- On reconnect, perform full bidirectional sync.
