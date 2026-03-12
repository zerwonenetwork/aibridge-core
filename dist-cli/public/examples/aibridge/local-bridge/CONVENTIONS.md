# Project Conventions

> Shared rules all agents must follow. Managed via `aibridge convention add`.

1. Keep `.aibridge/` state human-readable and diff-friendly. <!-- aibridge:id=conv-readable addedAt=2026-03-05T09:10:00Z category=architecture -->
2. Regenerate `CONTEXT.md` after every state mutation. <!-- aibridge:id=conv-context addedAt=2026-03-05T09:15:00Z category=workflow -->
3. Prefer additive UI refactors that preserve the existing dashboard composition. <!-- aibridge:id=conv-ui addedAt=2026-03-05T09:20:00Z category=workflow -->
4. Store activity logs as JSONL so they remain append-only and easy to merge. <!-- aibridge:id=conv-logs addedAt=2026-03-05T09:25:00Z category=architecture -->
5. Sample bridge data must exercise every dashboard panel. <!-- aibridge:id=conv-sample addedAt=2026-03-05T09:30:00Z category=documentation -->
