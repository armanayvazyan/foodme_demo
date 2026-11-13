---
paths:
  - "apps/backend/src/test/**"
---

# Testing: backend

```bash
cd apps/backend
./gradlew test
./gradlew test --tests OrderControllerTest
./gradlew test --tests 'OrderControllerTest.someMethod'
```

- **Test style.** Tests are `@SpringBootTest` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")` integration tests, one class per controller. They test through HTTP with MockMvc. Follow that pattern rather than mocking services.
- **Test profile.** `application-test.properties` sets up:
  - H2 in-memory DB in PostgreSQL mode with `create-drop` and Flyway off
  - seed data from `src/test/resources/data.sql`
  - images seed off
  - latency 0
  - HTTP logging off
  - empty Sentry DSN
  - test JWT secret

  The flaky heartbeat is disabled (`@Profile("!test")`). No Postgres or network is needed.
- **Test data.** `data.sql` is separate from the Flyway seed (its own chefs, IDs and prices). If a test needs new data, add it there. If you add a column through a migration, update `data.sql` too. Tests share one context and one DB. Create fresh entities (for example, a new customer per test) instead of depending on order between tests.
- **Customer endpoints.** Register or log in through `/api/auth/**` to get a JWT, or use `spring-security-test` helpers.
- **Planted defects.** Some tests assert buggy behaviour on purpose, so CI stays green while the defect exists. Don't "fix" a failing-looking assertion near an `FM-BUG-nn` marker without asking.
