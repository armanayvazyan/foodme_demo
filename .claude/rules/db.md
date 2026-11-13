---
paths:
  - "apps/backend/src/main/resources/db/**"
  - "apps/backend/src/main/java/am/foodme/backend/model/**"
  - "apps/backend/src/main/java/am/foodme/backend/repository/**"
  - "apps/backend/src/test/resources/data.sql"
---

# Database (Postgres + Flyway)

- **Flyway owns the schema.** Everything lives in schema `foodme`, and Flyway migrations (`src/main/resources/db/migration/V<n>__<name>.sql`) are the only source of it. JPA runs with `ddl-auto=validate`, so the app won't start if an entity doesn't match the schema.
- **Entity changes need a migration.** When you change an entity, add a new `V<next>__…sql`. Never edit a migration that has already shipped (V1–V3): deployed databases have applied it, and Flyway's checksum validation will fail.
- **Seed data is in the migrations.** They create chefs, dishes, tags and the `admin` user (BCrypt hash in V1). The course test cases, e2e tests and planted-defect scenarios depend on specific seed IDs and prices. Don't change existing seed rows. Add new rows instead.
- **Images live in Postgres** (`foodme.image`, added by V2). `ImageSeedRunner` loads `classpath:/img-seed/**` on first start when `foodme.images.seed-enabled=true`.
- **Timestamps are UTC** (`hibernate.jdbc.time_zone=UTC`). `open-in-view` is off, so lazy relations must be loaded inside the service transaction.
- **Connection settings.** Priority order:
  1. `DATABASE_URL` (Render/Neon `postgresql://…`, converted by `DatabaseUrlEnvironmentPostProcessor`)
  2. `SPRING_DATASOURCE_URL`
  3. `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`, defaulting to `localhost:5432` and `foodme` / `foodme`

  Flyway retries the connection 10 × 10 s, because the free Render DB is slow to wake.
- **Tests don't run Flyway.** They use H2 in PostgreSQL mode with `create-drop`, seeded from `src/test/resources/data.sql`. So a column or table added in a migration must also be reflected in `data.sql` if tests need the data. Stick to SQL that works in both Postgres and H2 PostgreSQL mode for anything tests touch.
