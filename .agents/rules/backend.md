---
paths:
  - "apps/backend/**"
---

# Backend conventions

- Keep the layering: controllers stay thin, business logic goes in services, persistence in repositories. Never return entities from controllers.
- Use the route prefix constants in `utils/ControllerUtil`. Don't hardcode prefixes.
- Throw `NotFoundException` / `BadRequestException` and let `GlobalExceptionHandler` shape the response. Don't build error responses in controllers.
- Any entity change needs a new Flyway migration (`V<n>__*.sql`). Never edit an existing migration.
- A new DTO that carries an image URL must be registered in `ImageUrlResponseAdvice`.
- `DatabaseUrlEnvironmentPostProcessor` must stay in `META-INF/spring.factories`. Spring ignores `META-INF/spring/*.imports` for this extension point.
- The Loki `<if>` block must stay a direct child of `<configuration>` in `logback-spring.xml`.

## Tests

- Use the `backend-tests` skill when writing tests. Integration tests are `@SpringBootTest` + MockMvc with `@ActiveProfiles("test")`.
- The test profile uses H2 (PostgreSQL mode) with Flyway **off**. The schema comes from Hibernate `create-drop` and seed data from `src/test/resources/data.sql`. Latency, the heartbeat and HTTP logging are also off.
- Green tests don't prove a migration works. Check migrations against real Postgres.
- From `apps/backend`: `./gradlew test --tests <Class>` for a focused run, `./gradlew build` before calling work done.
