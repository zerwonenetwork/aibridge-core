# Capture Layer Specification

## Purpose

The capture layer automatically ingests local developer and agent activity into `.aibridge/logs/`, enabling passive coordination without requiring agents to manually log every action.

## Components

### 1. Git Hook — Post-Commit Attribution

#### Installation

`aibridge init` installs a `post-commit` hook at `.git/hooks/post-commit`:

```bash
#!/bin/sh
aibridge log commit "$(git log -1 --pretty=%s)" --agent auto
```

#### Agent Attribution

The hook determines which agent made the commit:

1. Check `GIT_AUTHOR_NAME` or `GIT_COMMITTER_NAME` for known agent patterns.
2. Check `AIBRIDGE_AGENT` environment variable.
3. Check parent process tree for known process names:
   - `cursor` → Cursor agent
   - `claude` → Claude Code agent
   - `code` (with codex context) → Codex agent
   - `windsurf` → Windsurf agent
4. Fall back to `"human"` if no agent detected.

#### Output

Appends to `.aibridge/logs/{agentId}.jsonl`:
```json
{"id": "<uuid>", "agentId": "cursor", "action": "commit", "description": "feat: add auth middleware", "timestamp": "2025-01-15T10:30:00Z", "metadata": {"commitHash": "abc123", "filesChanged": 3}}
```

### 2. File Watcher — Change Detection

#### Behavior

A lightweight background process (started via `aibridge watch`) monitors the project directory for file changes.

#### Configuration

```json
{
  "watch": {
    "enabled": true,
    "debounceMs": 2000,
    "ignorePatterns": [
      "node_modules/**",
      ".git/**",
      ".aibridge/**",
      "dist/**",
      "*.log"
    ]
  }
}
```

#### Agent Process Detection

When a file change is detected:

1. Identify which process has the file open (platform-specific: `lsof` on macOS/Linux, `handle.exe` on Windows).
2. Match process to known agent patterns.
3. If no match, attribute to `"unknown"`.

#### Debounce

- Collect changes for `debounceMs` (default 2000ms).
- Batch multiple file changes from the same agent into a single log entry.
- Log entry description: `"Modified {n} files: {file1}, {file2}, ..."` (truncate at 5 files).

### 3. Self-Log Validation

Agents write their own log entries. The capture layer validates these on read:

#### Validation Rules

1. Every entry must conform to `log-entry.schema.json`.
2. `agentId` must match a registered agent in `bridge.json`.
3. `timestamp` must be valid ISO 8601 in UTC.
4. `id` must be a valid UUID and unique within the log file.
5. Entries must be in chronological order within a single file.

#### On Validation Failure

- Log a warning to stderr.
- Skip the invalid entry (do not include in `CONTEXT.md`).
- Write validation error to `.aibridge/logs/_validation-errors.jsonl`.

## Process Model

The capture layer runs as:
- **Git hooks**: Synchronous, triggered by git operations.
- **File watcher**: Long-running background process (`aibridge watch`), daemonizable.
- **Validation**: On-demand, triggered during `aibridge context` or `aibridge status`.
