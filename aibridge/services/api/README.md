# Backend API Boundary

Backend service responsibilities:

- expose read/write APIs for dashboard
- validate payloads against protocol schemas
- stream activity/task/message updates via realtime events
- execute `sync` orchestration hooks

This service is intentionally separate from UI so Lovable can consume a stable API contract.
