---
name: write-integration-tests
description: Write backend integration tests that call REST endpoints
  through MockMvc with a real Spring context and H2 database. Use when
  the user asks for API tests, integration tests or tests of a backend flow.
---
1. Read the controller/service and the AC. Never invent AC.
2. Follow apps/backend/src/test/java/am/foodme/backend/OrderControllerTest.java:
   @SpringBootTest, @AutoConfigureMockMvc, @ActiveProfiles("test"). File name <Feature>ControllerTest.java
3. Test through the real HTTP boundary (MockMvc). Mock only third-party services.
4. Create unique test data per test (random email, like the existing tests). No test may depend on another.
5. Cover: success, validation errors (400), not found (404), permission errors (401/403).
6. @DisplayName("FM-<ticket>-<nn>: ...") and a comment "AC: <number>".
7. Run: cd apps/backend && ./gradlew test --tests '*<Feature>ControllerTest'. Report PASS/FAIL. Never edit apps/backend/src/main.
Output: a table "Test ID | AC covered | Result".
