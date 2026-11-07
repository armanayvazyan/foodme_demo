---
paths:
  - "apps/backend/src/test/**"
  - "apps/backend/src/main/resources/application-test.properties"
---

# Backend testing rules

## Commands (from `apps/backend`; on Windows use `.\gradlew.bat`)
```
./gradlew test
./gradlew test --tests am.foodme.backend.OrderControllerTest
./gradlew test --tests 'am.foodme.backend.OrderControllerTest.methodName'
```

## How the suite works
- Tests are integration tests that start the full Spring context: `@SpringBootTest` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")`. They go through HTTP via MockMvc. There are no mocked service unit tests, so follow the same pattern for new tests.
- The `test` profile (`src/main/resources/application-test.properties`):
  - uses H2 in memory in PostgreSQL mode
  - **disables Flyway**; Hibernate `create-drop` builds the schema from the entities
  - loads seed data from `src/test/resources/data.sql`
  - turns off simulated latency, the HTTP logging filter, image seeding, Sentry and the flaky heartbeat job
- Because Flyway is off, the tests won't catch a broken migration or a mismatch between migration and entity.
- If a test needs new seed rows, add them to `src/test/resources/data.sql`.
- Tests that need a customer register a unique user through `/api/auth/register` and use the returned JWT (see `OrderControllerTest.customerToken()`). Generate unique emails, because the H2 database is shared across a test class.
- `OrderControllerTest` uses `@TestMethodOrder(OrderAnnotation)`, so keep `@Order` values consistent when you add tests.

## Planted bugs
Some code paths contain intentional `FM-BUG-NN` defects. A failing test may be finding a planted bug, not a regression. Don't change production code to make a test pass unless the task asks for that fix.
