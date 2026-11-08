---
paths:
  - "apps/backend/**"
---

# Backend (Spring Boot 3.3, Java 17, Gradle)

- Layers: `controller/{api,admin}` → `service` → `repository` (Spring Data JPA) → `model`.
  DTOs in `dto/`; errors via `exceptionHandler/` (`NotFoundException` → 404, `BadRequestException` → 400).
- Constructor injection only (see `OrderService`). Lombok `@Getter/@Setter` on DTOs/entities.
- Schema `foodme` is owned by Flyway (`src/main/resources/db/migration`). Hibernate is `validate`
  in prod — every entity change needs a **new** migration `V<next>__<what>.sql`. Never edit an
  applied migration (blocked by `guard-files.mjs`).
- Tests run with profile `test`: H2 in PostgreSQL mode, `ddl-auto=create-drop`, seed data from
  `src/test/resources/data.sql`, Flyway off, latency simulation off.
- Commands (from `apps/backend`): `./gradlew test`, `./gradlew test --tests '*OrderServiceTest'`,
  `./gradlew bootRun` (needs Postgres; see `.env.example`).
- Requires a JDK 17 toolchain (`build.gradle`). If Gradle says no matching toolchain, install JDK 17.
