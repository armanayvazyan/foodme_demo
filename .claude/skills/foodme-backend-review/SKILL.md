---
name: foodme-backend-review
description: Use when asked to review backend code in FoodMe - a diff, branch, PR or files under apps/backend (Spring Boot controllers, services, DTOs, security, JPA entities, Flyway migrations, backend tests). Triggers - "review the backend", "review this PR's API changes", "check my service change", "backend code review".
---

# FoodMe backend code review

Read-only review of changes under `apps/backend/**`. Output is a verified findings list. Never edit code, commit, or post to GitHub unless explicitly asked.

## 0. Ground rules (read first)

- **Planted defects.** Lines marked `FM-BUG-nn` and tests asserting them are intentional. List them under "Known planted defects" only if the diff touches them; never count them as new findings or suggest fixes.
- **Unmarked defects exist on purpose.** Report what you find in the local review, but never put findings into commit messages, PR descriptions or PR comments without asking first; students' agents read GitHub. If asked to post (`--comment`, "post it"), warn once that this exposes findings publicly, then do it.
- **Frozen contract.** Any change to a REST path, HTTP method, DTO field name or JSON name is a **Blocker**, even if it "looks cleaner".
- **Shipped migrations are immutable.** Any edit to `V1`–`V3` (or any migration already on `main`) is a **Blocker**.
- Load `.claude/rules/backend.md`, `db.md`, `testing-backend.md` before judging. They describe things that look wrong but are intentional (simulated latency, flaky heartbeat, request logging, SPA fallback, image URL rewriting).

## 1. Resolve the target

| Input | Diff command |
|---|---|
| nothing | `git diff main...HEAD -- apps/backend` plus `git diff HEAD -- apps/backend` (uncommitted) |
| branch name | `git diff main...<branch> -- apps/backend` |
| PR number | `gh pr diff <n>` then keep only `apps/backend/**` hunks; `gh pr view <n>` for intent |
| path(s) | review those files as they are now |

If the backend part of the diff is empty, say so and stop. Note the ticket key / intent (branch name, PR body, commit messages) so findings are judged against what the change is supposed to do.

## 2. Build context, not just hunks

For every changed file read the **whole file**, then follow one hop out:
- controller changed → its service, DTOs, `SecurityConfig` matcher for the path, `GlobalExceptionHandler`
- service changed → its callers, repositories, entities, `@Transactional` boundaries
- entity changed → matching migration, `data.sql`, every DTO mapping it
- DTO changed → web `src/types/index.ts` and admin `src/api/*-api.js` consumers (contract check)

Use an `Explore` agent only if the diff spans many packages; otherwise read directly.

## 3. Checklist

### Correctness
- Business rules match the ticket/spec: totals, quantities, min/max, delivery price, order status transitions.
- Money: `BigDecimal` with explicit scale/rounding; no `double` arithmetic; consistent rounding on write vs read.
- Null / `Optional`: `.get()` without check, `orElse(null)` passed on, missing `NotFoundException` for absent IDs.
- Pagination: backend is **0-based**; off-by-one on last page, `count` vs `list` consistency, sort stability on ties.
- Collections: mutating while iterating, duplicate handling, empty input.
- Time: UTC only (`hibernate.jdbc.time_zone=UTC`); no `LocalDateTime.now()` vs `Instant` mixups across boundaries.

### Transactions and JPA
- `open-in-view` is **off**: lazy relations touched outside the service transaction → `LazyInitializationException`. DTO mapping must happen inside `@Transactional` service methods.
- Writes in `@Transactional` (not `readOnly`); multi-step writes atomic.
- N+1: lazy collections accessed in loops / stream maps; prefer fetch joins or batched queries.
- Lombok on entities: `@Data`/`@ToString`/`@EqualsAndHashCode` across bidirectional relations → recursion / broken hash sets.
- `DishSearchRepositoryImpl` and any native/JPQL: no string-concatenated user input (injection); parameters bound.

### API and errors
- Controllers return `dto/*`, never entities.
- Input validated (`@Valid`, bean constraints, explicit checks) → `BadRequestException`; absent → `NotFoundException`; both go through `GlobalExceptionHandler` as `ErrorResponseDto`. No raw 500s, no stack traces or internals in responses.
- Correct status codes; idempotency of PUT/DELETE.
- Contract frozen (see ground rules). New fields are additive only.

### Security
- New endpoint has the right matcher in `SecurityConfig`: `/api/customer/**` + `POST /api/order` need `ROLE_CUSTOMER`; `/admin/**` needs admin JWT except `GET /admin/dish/**` and `/admin/auth/login`. Anything else under `/api/**` is **public** — check that is intended.
- Ownership / IDOR: customer endpoints must scope by the JWT principal, not by an ID from the request.
- Mass assignment: request DTOs must not let clients set price, status, owner, role.
- Secrets: nothing hard-coded; new secret-bearing fields redacted in `HttpLoggingFilter`; no tokens or passwords in logs.
- `DebugController` and actuator: no new sensitive exposure.

### Database
- Entity change ⇒ new `V<next>__<name>.sql`; `ddl-auto=validate` must pass (column names, types, nullability, schema `foodme`).
- Existing seed rows unchanged (course scenarios depend on IDs and prices); new data as new rows.
- Test data: `src/test/resources/data.sql` updated for new columns/tables; SQL valid in both Postgres and H2 PostgreSQL mode.

### Deploy (Render free tier: 512 MB, 0.1 CPU)
- No loading whole tables into memory; no unbounded queries or caches.
- Untouched: `META-INF/spring.factories` registration, Dockerfile JVM flags, `server.tomcat.threads.max=32`, janino dependency for `logback-spring.xml`.
- New dependencies justified (startup time and image size matter).
- New config has safe defaults so a fresh fork deploys without extra env vars.

### Tests
- New behaviour covered by `@SpringBootTest` + MockMvc integration tests in the controller's test class (repo style: no service mocks).
- Tests create fresh entities (unique customer per test), don't depend on order.
- Tests assert behaviour, not implementation; negative paths (400/401/403/404) covered.
- Tests near `FM-BUG-nn` assertions not altered.
- **Parametrize when possible (rule).** Two or more tests that differ only in input/expected values (e.g. several invalid payloads → 400, several roles → 403, boundary quantities) must be one JUnit 5 `@ParameterizedTest` with `@CsvSource` / `@ValueSource` / `@MethodSource` / `@EnumSource` (`junit-jupiter-params` comes with `spring-boot-starter-test`). Copy-pasted test methods that could be parametrized are a **Minor** finding; name the methods to merge and the source annotation to use. Keep separate methods only when setup or assertions genuinely differ.

### Quality (report as Minor/Nit, only if real)
- Dead code, duplicated logic that already exists in a service/util, misleading names, swallowed exceptions, magic numbers for business limits.

## 4. Run checks

From `apps/backend`: `./gradlew test` (no Postgres needed; H2). If it fails, attribute each failure: caused by the diff, pre-existing on `main`, or a planted-defect test. Don't claim "tests pass" without running them; if you skip, say why.

### Stability gate for added or changed tests (10 runs)

Every test method added or modified in the diff must pass **10 out of 10** consecutive runs to count as passing. List them from the diff (`@Test` / `@ParameterizedTest` methods in added/changed hunks), then for each class:

```bash
cd apps/backend
pass=0; for i in $(seq 1 10); do
  ./gradlew test --rerun --tests 'am.foodme.backend.OrderControllerTest.newMethod' -q && pass=$((pass+1))
done; echo "newMethod: $pass/10"
```

`--rerun` stops Gradle from skipping the task as up to date. Several methods of one class can share a run with repeated `--tests` filters. For a parametrized test, every case must pass in all 10 runs.

- 10/10: passed.
- 1–9/10: **flaky**. Report it as a **Major** finding with the failing run's assertion message, and name the likely cause: order dependence, shared DB state, time, randomness, or async.
- 0/10: failing. Attribute the cause as above.

Report the score per test in the Checks section (e.g. `OrderControllerTest.rejectsZeroQuantity 10/10`). Never report an added test as passing from a single run.

## 5. Verify every finding

Before reporting, re-read the code for each candidate and drop it unless you can state a **concrete failure**: input/state → wrong output, crash, leak or broken deploy. Mark each kept finding **Confirmed** (traced or reproduced) or **Plausible** (strong reasoning, not reproduced). Drop style opinions that contradict the repo's existing patterns.

## 6. Report

Severity: **Blocker** (contract break, security hole, data loss, broken deploy/migration) · **Major** (wrong behaviour users hit) · **Minor** (edge case, missing test, maintainability) · **Nit**.

Per finding: severity, confidence, `file:line`, one-line defect, failure scenario, suggested fix (in words; no patch unless asked).

Write the full report as one self-contained HTML file in the session scratchpad (`backend-review-<target>.html`) and `open` it. In chat, give: target reviewed, check results (`./gradlew test` outcome), counts by severity, and the top findings in one line each. Sections:

1. Summary and verdict (approve / approve with nits / request changes)
2. Findings, most severe first
3. Known planted defects touched (if any)
4. Checks run and results
5. Not reviewed / out of scope (e.g. frontend hunks → suggest `foodme-frontend-review`)
