# Project Conventions

> Shared rules all agents must follow. Managed via `aibridge convention add`.

1. All API responses must use the `{ data, error, meta }` envelope format.
2. Database migrations must be reversible.
3. Every new endpoint requires at least one integration test.
4. Use `snake_case` for database columns, `camelCase` for TypeScript.
5. Commit messages follow Conventional Commits format.
6. No direct database queries in route handlers — use service layer.
