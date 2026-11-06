---
paths:
  - "apps/backend/**"
---

# Backend rules

- Java 17 and Spring Boot 3.3. Services take dependencies through the
  constructor; keep it that way so they stay unit-testable without Spring.
- Schema changes go in a new Flyway migration,
  `src/main/resources/db/migration/V<next>__<name>.sql`. Never edit one that
  has shipped: Render's database has already applied it. JPA runs with
  `ddl-auto=validate`, so an entity change without a migration fails at startup.
- Tests run on H2 with Flyway off, so they don't check migrations. Read the
  migration against the entity yourself.
- Signal errors with `NotFoundException` (404) or `BadRequestException` (400);
  `GlobalExceptionHandler` turns them into `ErrorResponseDto`.
- Access rules live in `security/SecurityConfig.java`. A new `/api/**` path is
  public by default, so decide deliberately whether it should be.
- Run `./gradlew test` from `apps/backend` before finishing. It needs JDK 17.
