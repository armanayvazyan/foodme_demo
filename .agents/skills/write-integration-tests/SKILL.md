---
name: write-integration-tests
description: Write integration tests for foodme_demo, which test several parts working together (API + database, hooks + storage). Use when asked for integration tests or to test a full API endpoint or data flow.
---
# Writing integration tests

Integration tests check that real parts work together. Mock only things outside our system (payment providers, external APIs).

## Backend (apps/backend)
- Use Spring Boot test tools if the project uses Spring (check `build.gradle`):
  - `@SpringBootTest` + `MockMvc` to call real endpoints
  - an in-memory or test database, never the real one
- Test the full request: status code, response body, and what was saved in the database.
- Cover: success, validation error (bad input), not found, and unauthorized if the endpoint needs login.
- Put them in `src/test/java/.../integration/`, named `<Feature>IntegrationTest.java`.
- Run: `./gradlew test --tests "*IntegrationTest"` from `apps/backend`.

## Frontend (apps/web, apps/admin)
- Test hooks and `lib` code together with the real storage layer, not a mock.
  - If the code uses IndexedDB (for example `db.products` in `useCart.ts`), use `fake-indexeddb` so the real database code runs in memory.
  - Mock HTTP calls with MSW instead of mocking our own functions.
- Name files `<feature>.integration.test.ts`.
- Reset the database or state before each test so tests don't depend on each other.

## Rules
- Each test sets up its own data and cleans up after itself.
- Tests must pass when run alone and in any order.
- No real external services, no `sleep`.

## Done when
- [ ] Success and failure paths are covered
- [ ] Tests run and pass, and you showed the output
