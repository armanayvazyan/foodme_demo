---
name: write-unit-tests
description: Write backend unit tests (JUnit 5 + Mockito) for one service
  or utility class, without starting Spring. Use when the user asks for
  unit tests or to cover a class in apps/backend/src/main with fast tests.
---
1. Read the class under test (apps/backend/src/main/java/am/foodme/backend/service/) and the ticket/AC it implements.
   If the AC is unknown, ask. Never invent it.
2. Create apps/backend/src/test/java/am/foodme/backend/<Class>UnitTest.java (same package as existing tests).
3. One test = one behaviour.
   @DisplayName("FM-<ticket>-<nn>: <what> when <condition>") and a comment "AC: <number>".
4. Cover: happy path, boundary values, invalid input, error path.
5. Mock repositories and other collaborators with Mockito. Do not mock the class under test.
   Do not use @SpringBootTest in a unit test.
6. Run: cd apps/backend && ./gradlew test --tests '*<Class>UnitTest'. Report PASS/FAIL for each test.
7. If a test fails, report it. Do NOT change apps/backend/src/main and do NOT weaken the assertion.
8. The front-end has no unit-test framework. If the user asks for front-end unit tests, say so and ask before adding dependencies.
Output: a table "Test ID | AC covered | Result".
