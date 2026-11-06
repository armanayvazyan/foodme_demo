---
paths:
  - "apps/backend/src/main/resources/db/**"
  - "apps/backend/src/main/java/am/foodme/backend/model/**"
  - "apps/backend/src/main/java/am/foodme/backend/repository/**"
  - "apps/backend/src/main/resources/application*.properties"
---

# Database rules

PostgreSQL. All tables are in schema `foodme`.

## Migrations
- Flyway migrations are in `apps/backend/src/main/resources/db/migration`, named `V{n}__description.sql`.
- Never edit an existing migration, because deployed databases have already run it. Add the next `V{n}` instead.
- Hibernate runs with `ddl-auto=validate`. Every entity change in `model/` needs a matching migration, or the app won't start.
- Tests don't run Flyway (see the backend testing rule). A broken migration only shows up against a real Postgres, so check new SQL against Postgres when you can.

## Connection config
- `config/DatabaseUrlEnvironmentPostProcessor` (registered in `META-INF/spring.factories`) reads `DATABASE_URL` or `NEON_DATABASE_URL`. It converts a `postgresql://user:pass@host/db` value (Render/Neon) into the JDBC URL, username and password.
- Without those variables, the app uses `SPRING_DATASOURCE_URL` or the separate `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` values. The local default is `localhost:5432` with db, user and password all `foodme`.
- Flyway retries the connection 10 times, 10 s apart, because the Render database may still be starting up.

## Images in the database
Pictures are stored in `foodme.image`. On first start, `service/ImageSeedRunner` loads them from `resources/img-seed/` (turn this off with `FOODME_IMAGES_SEED_ENABLED=false`). Image references in rows are stored relative (`/api/images/...`), never as absolute URLs.

## Repositories
These are Spring Data JPA interfaces. The one custom query implementation is `DishSearchRepository` / `DishSearchRepositoryImpl`.
