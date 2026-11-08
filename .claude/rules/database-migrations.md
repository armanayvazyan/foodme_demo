---
paths:
  - "apps/backend/src/main/resources/db/**"
---

# Flyway migrations

- Applied migrations (`V1__init.sql`, `V2__…`, `V3__…`) are immutable: Flyway checksums them on
  every start, and Render/Neon databases already ran them. Editing one is blocked by a hook.
- New change → new file `V<highest+1>__<snake_case_description>.sql`, in schema `foodme`.
- Keep migrations forward-only and idempotent where practical (`IF NOT EXISTS`).
- If tests need the new data, also update `apps/backend/src/test/resources/data.sql` (tests use
  H2 + `ddl-auto`, not Flyway).
