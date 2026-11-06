---
name: write-integration-tests
description: Write backend integration tests for the FoodMe Spring Boot API, using @SpringBootTest, MockMvc and the in-memory H2 test database, covering endpoints, security rules, validation, error responses and persistence. Use this whenever the task is to test an /api or /admin endpoint, check a status code, auth rule or JSON response, test a repository query, or reproduce a backend bug through HTTP — even if the request just says "test the order API" or "add a backend test". For a single class with mocked dependencies, use write-unit-tests; for anything through a browser, use write-e2e-tests.
---

# Write integration tests

An integration test here starts the whole Spring application against an
in-memory H2 database and calls it through MockMvc. It checks that the
controller, security, validation, service and JPA layers work together, which
a unit test can't. Each test class costs a few seconds of startup, so use
these for behaviour that crosses layers, not for logic a unit test can cover.

## The setup you get

Every existing class in `apps/backend/src/test/java/am/foodme/backend/` uses
this, and new ones should too:

```java
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChefControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;
}
```

The `test` profile (`src/main/resources/application-test.properties`) does
three things worth knowing:

- **Schema:** Hibernate creates it from the entities (`create-drop`) and
  Flyway is off. So these tests **don't** check the migrations in
  `db/migration/`. A missing or wrong migration passes here and fails on
  Render. If you change an entity, check the migration by reading it.
- **Data:** `src/test/resources/data.sql` seeds a small fixed dataset. Read it
  before writing assertions. At the time of writing it has chefs 1 and 2
  (active) and 3 (inactive), dishes 1–3 (active) and 4 (inactive), and admin
  user `admin`.
- **Noise off:** simulated latency, request logging, the flaky heartbeat job
  and Sentry are disabled, so failures are your test's, not the environment's.

## Test isolation

Spring reuses one application context, and so one H2 database, across every
test class in the run. Data one test writes is visible to the next.

- **Make what you create unique.** Register customers with a UUID in the email,
  as `CustomerAuthControllerTest` does. Fixed emails collide when tests run in
  a different order.
- **Don't assert on totals other tests can change**, such as the number of
  orders. Assert on the records your test created, found by ID or number.
- **Don't rely on test order.** Each test should set up what it needs, so it
  passes when run alone with `--tests`.
- Assertions on seed data (for example "chef 1 has 2 active dishes") are fine,
  as long as no test modifies that seed data.

## Authentication

- **Customer:** `POST /api/auth/register` with `fullName`, `email`,
  `phoneNumber` and `password` returns `{ token, customer }`. Send the token as
  `Authorization: Bearer <token>`. `OrderControllerTest.customerToken()` is a
  helper you can copy.
- **Admin:** `POST /admin/auth/login` with `username` and `password` returns
  `{ token, username, role }`. The seeded admin is `admin`, and the e2e tests
  log in with password `admin123`.
- **Rules:** `SecurityConfig` decides which paths need which role. When you
  test a protected endpoint, test the unauthenticated and wrong-role cases as
  well as the allowed one, because security regressions only show up there.

## What to assert

- **Status first, then body.** `status().isOk()` then
  `jsonPath("$.field").value(...)`. Errors use `ErrorResponseDto`: check
  `status`, and `message` when the exact wording matters to callers.
- **Not-found and bad-request paths.** `NotFoundException` maps to 404 and
  `BadRequestException` to 400 in `GlobalExceptionHandler`. Every endpoint that
  takes an ID or a body should have at least one failing-input test.
- **State, not just the response.** When an endpoint writes data, read it back,
  either through a GET endpoint or by autowiring the repository, to prove it
  was stored.
- **Boundaries.** Minimum order counts, free-delivery thresholds, inactive
  chefs and dishes are where this domain's bugs live.

## H2 is not PostgreSQL

H2 runs in PostgreSQL mode, but it isn't Postgres. Native SQL
(`nativeQuery = true`), sequences, JSON functions and case-sensitivity rules
can behave differently. If a test of a native query passes here, say that it
was checked on H2 only. If it fails on H2 but the code is right for Postgres,
don't change the production query to suit H2; report it instead.

## Run

From `apps/backend` (needs JDK 17):

```bash
./gradlew test --tests '*OrderControllerTest'
./gradlew test
```

Run the single class while you work, then the whole suite before you finish,
because shared data means a new test can break an existing one.

## Before you finish

- The new test passes alone and as part of the full suite.
- A regression test fails against the buggy code and passes after the fix.
- If you couldn't run the suite (for example, no JDK), say so plainly. Don't
  report the test as passing.
