---
name: write-integration-tests
description: Write FoodMe backend integration tests — Spring Boot + MockMvc + H2 exercising real controllers, security (JWT), validation, services and JPA together. Use when adding or changing a REST endpoint, request/response DTO, security rule, repository query, or entity mapping, or when an API bug needs a reproducing test. Also covers API-level checks in Playwright (request fixture). Not for pure logic (write-unit-tests) or UI flows (write-e2e-tests).
---

# Write integration tests

Integration tests boot the **real Spring context** against an in-memory H2 database and call
endpoints through `MockMvc`. They prove that controller + security + validation + service +
repository + schema work *together*.

## Environment facts (profile `test`)

- `@ActiveProfiles("test")` → `src/main/resources/application-test.properties`:
  H2 in PostgreSQL mode, schema `foodme`, `ddl-auto=create-drop`, **Flyway disabled**,
  JWT secret `test-secret`, latency simulation off.
- Seed data: `src/test/resources/data.sql`, loaded **once per Spring context**:
  chefs 1 `marta-k` (ACTIVE, delivery 700, free from 8000), 2 `ararat-grill` (ACTIVE),
  3 `closed-kitchen` (INACTIVE); dishes 1–3 ACTIVE, 4 INACTIVE; admin `admin` / `admin123`.
- The context (and DB) is **shared across test classes** — data you create persists for later
  tests. So: create unique data (`UUID` emails), and never assert on global counts that other
  tests can change ("exactly 3 orders"). Assert on what *you* created.

## Template

Reference implementation (copy its shape): `src/test/java/am/foodme/backend/DeliveryPriceControllerTest.java`.

```java
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DeliveryPriceControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    // A small request helper keeps each test to "arrange → act → assert" in a few lines.
    private ResultActions deliveryPrice(Object chefId, Object subtotal, String method) throws Exception {
        return mockMvc.perform(post("/api/order/delivery-price")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "chefId", chefId, "subtotal", subtotal, "deliveryMethod", method))));
    }

    @Test
    void deliveryPrice_unknownChef_returns404WithErrorBody() throws Exception {
        deliveryPrice(999, 3000, "DELIVERY")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Chef 999 not found"));
    }
}
```

Before writing, read the real route (`utils/ControllerUtil.java` holds the path constants), the
controller method and the request DTO field names — don't guess them.

**Boundaries next to planted defects:** exact-threshold cases (e.g. subtotal *equal to*
`freeDeliveryFrom`, quantity *equal to* the minimum) are where the `FM-BUG-NN` defects live. If such
a test fails next to a marker, that is a planted defect: report it (or mark the test with its
ticket), don't fix the product code unless that defect is your task.

## Auth

- Customer JWT: register via `POST /api/auth/register` with a unique email and read `$.token`
  (copy the `customerToken()` helper from `OrderControllerTest`). Send `Authorization: Bearer <token>`.
- Admin JWT: `POST /admin/auth/login` with `admin` / `admin123`.
- Always add the **negative** security case for a protected endpoint (no token → 401/403).
  Read `security/SecurityConfig.java` for the real rule first: e.g. `POST /api/order` needs
  `ROLE_CUSTOMER`, but `/admin/**` is only `authenticated()` — whether a *customer* token is
  rejected there is something to test and report, not to assume.

## What to cover per endpoint

1. Success: status + the response fields the client relies on (`jsonPath`).
2. Validation: missing/invalid fields → 400. Every error uses `ErrorResponseDto`:
   `{ timestamp, status, error, message, path }`, so assert e.g.
   `jsonPath("$.status").value(404)`, `jsonPath("$.message").value("Chef 999 not found")`.
3. Not found → 404 (unknown id), inactive entities hidden (chef 3, dish 4).
4. AuthZ: anonymous / wrong role.
5. Persistence round-trip when relevant: create, then GET and assert it is there.

## Rules

- Prefer `@Test` independence over `@TestMethodOrder` — existing ordered tests are legacy; don't add new order dependencies.
- If your test needs new seed rows, add them to `data.sql` with ids that don't collide (≥ 100) and
  remember a matching Flyway migration if prod needs them too.
- Slow? Don't add `@DirtiesContext` (it reboots Spring). Create unique data instead.
- No `Thread.sleep`, no assertion-free tests, `@Disabled` needs a Jira key (hook-enforced).

## API checks inside Playwright

For contract checks that need the *running* stack (real Postgres, Flyway data), use the
`request` fixture in an E2E spec — see `registerCustomerViaApi` in `apps/web/e2e/auth.ts`. Keep
these few; MockMvc is faster and deterministic.

## Run

```bash
cd apps/backend
./gradlew test --tests '*OrderControllerTest'            # one class
./gradlew test --tests '*OrderControllerTest.createOrder*'  # matching methods
./gradlew test                                            # whole backend suite
```

Reports: `apps/backend/build/reports/tests/test/index.html`, XML in `build/test-results/test/`.

## Done checklist
- [ ] Real route and DTO field names verified in the controller/DTO source.
- [ ] Success + at least one failure/authZ case per endpoint touched.
- [ ] Unique data; no reliance on global counts or test order.
- [ ] Ran the class, saw it pass, and saw it fail once by breaking the expectation.
