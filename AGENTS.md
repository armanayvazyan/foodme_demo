# FoodMe QA - team instructions

## Project map
- apps/backend  Spring Boot 3 (Java 17, Gradle). Tests: JUnit 5 + MockMvc.
- apps/web      Customer storefront (React + Vite). E2E: Playwright.
- apps/admin    Admin panel (React + Vite). E2E: Playwright.
- infra/        Docker compose and monitoring.

## Test rules
- New test IDs: FM-<ticket>-<nn>, ticket = Jira key without the dash.
  Example: FM-SCRUM5-01
- Put the ID at the start of the test title (Playwright test name or JUnit @DisplayName).
- Every test cites the Acceptance Criterion it covers in a comment: "AC: 2"
- Existing tests have no IDs. Use IDs for NEW tests only. Do not rename old tests.
- The repo already uses FM-BUG-xx and FM-FLAKE-xx in comments as defect / flaky-test
  markers, and FM-1000xx as order numbers. Do not reuse those prefixes for test IDs.
- Never invent acceptance criteria. If the AC is missing, ask the user.
- Never edit application code: apps/backend/src/main, apps/web/src, apps/admin/src.
  We write tests. A bug we find is reported, not fixed.
- Never delete, skip or weaken a test to make it pass.
- No waitForTimeout (Playwright) and no Thread.sleep (JUnit). Wait for a condition.

## Where tests live and how to run them
- Backend unit tests:        apps/backend/src/test/java/am/foodme/backend/  (named <Class>UnitTest)
- Backend integration tests: same folder (existing *ControllerTest, @SpringBootTest + MockMvc)
  Run all backend tests: cd apps/backend && ./gradlew test   (H2 database, profile "test")
- Web e2e:   apps/web/e2e/    run: cd apps/web && npm run test:e2e
- Admin e2e: apps/admin/e2e/  run: cd apps/admin && npm run test:e2e
- Both e2e:  cd apps/web && npm run test:e2e:all
- E2E needs the backend running on http://localhost:8081. Vite is started by Playwright.
- Shared e2e helpers: apps/web/e2e/auth.ts

## Style
- Plain English. Short answers. Report results as a table.
