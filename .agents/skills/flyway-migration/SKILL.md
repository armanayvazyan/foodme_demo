---
name: flyway-migration
description: Add a database schema change or seed data to the FoodMe backend via a new Flyway migration, keeping JPA entities, DTOs and the H2 test setup in sync. Use for "add a column", "new table", "seed more dishes/chefs", "change the schema".
---

# Flyway migration

## 1. Pick the version

```bash
ls apps/backend/src/main/resources/db/migration
```
New file = next number: `V<n+1>__<snake_case_summary>.sql`
(two underscores). **Never edit an applied migration** (V1, V2, V3, …) —
Flyway checksums them and the Render database will refuse to boot.

## 2. Write the SQL

- Everything lives in the `foodme` schema: `foodme.dish`, `foodme.chef`, …
- PostgreSQL syntax. Make it re-runnable where cheap
  (`ADD COLUMN IF NOT EXISTS`), and give new NOT NULL columns a DEFAULT so
  existing rows survive.
- Seed rows: use explicit high IDs (the repo uses `9001+`) to avoid clashing
  with sequences; image URLs follow
  `http://localhost:9000/foodme-images/chefs/<chefId>/dishes/<dishId>/av.jpg`.

## 3. Keep the code in sync

- Update the JPA entity in `model/` (column name, nullability).
- Update DTO mapping (`dto/*Dto.java` `mapEntityToDto` / `mapDtoToEntity`).
- If the web/admin shows the field, update `apps/web/src/types/index.ts` and
  the admin page.

## 4. Verify

- `./gradlew build` — note: tests use H2 with `ddl-auto=create-drop` and
  **Flyway disabled**, so they validate the entity, not your SQL.
- To validate the SQL itself, run the backend against a real Postgres
  (`./gradlew bootRun` with `DB_*` env from `.env.example`) and check the log
  for `Successfully applied 1 migration`.
- Tell the user explicitly which of these two checks you actually ran.
