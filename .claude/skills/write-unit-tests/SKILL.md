---
name: write-unit-tests
description: Write fast, isolated unit tests for FoodMe — Vitest for apps/web logic (hooks, lib, schemas) and JUnit 5 + Mockito for backend services. Use when adding or changing a function, hook, schema, or service method, when reproducing a logic bug before fixing it, or when the user asks for unit tests or more coverage. Not for HTTP endpoints (write-integration-tests) or browser flows (write-e2e-tests).
---

# Write unit tests

A unit test exercises **one module with its collaborators replaced**: no network, no real DB,
no Spring context, no browser. Each test runs in milliseconds.

## 1. Pick the layer (do this first)

| Code under test | Test type | Skill |
|---|---|---|
| Pure TS function, zod schema, cart helper, hook logic in `apps/web/src/{lib,hooks,schemas}` | **unit (Vitest)** | this one |
| Backend `service/*` method, util, DTO mapping | **unit (JUnit + Mockito)** | this one |
| Controller ↔ security ↔ JPA ↔ DB, request validation, status codes | integration | `write-integration-tests` |
| What the user sees/clicks across pages | E2E | `write-e2e-tests` |

If the logic you need to test is buried in a React component, extract it to `src/lib` or a hook
first (small refactor), then unit-test the extracted function.

## 2. Web (Vitest) — `apps/web`

- File: colocated `src/<path>/<name>.test.ts` next to `<name>.ts`.
- Imports: `import { describe, expect, it, beforeEach, vi } from "vitest";` and `@/…` aliases work.
- IndexedDB/Dexie works out of the box (`fake-indexeddb` in `src/test/setup.ts`); call
  `clearCart()` (or `db.products.clear()`) in `beforeEach` so tests do not share state.
- Mock modules with `vi.mock("@/api/client", () => ({ … }))`; time with `vi.useFakeTimers()`.
  `restoreMocks: true` is set globally — no manual `mockRestore`.
- Build inputs with a factory that has realistic defaults + overrides (see `makeDish` in
  `src/hooks/useCart.test.ts`). Do not copy 20-field literals into every test.

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDishToCart, clearCart } from "./useCart";

beforeEach(() => clearCart());

describe("addDishToCart", () => {
  it("starts at the dish minimum order count", async () => {
    const dish = makeDish({ minimumOrderCount: 3 });
    await addDishToCart(dish);
    expect((await db.products.get(uidOf(dish)))?.quantity).toBe(3);
  });
});
```

Run: `cd apps/web && npx vitest run src/hooks/useCart.test.ts` (one file) · `-t "minimum"` (one test) · `npm run test:unit` (all).

## 3. Backend (JUnit 5 + Mockito + AssertJ) — `apps/backend`

- File: `src/test/java/am/foodme/backend/<same package as class>/<Class>Test.java`.
- `@ExtendWith(MockitoExtension.class)`, `@Mock` each repository, construct the service by hand
  in `@BeforeEach` (services use constructor injection). Use `new SimpleMeterRegistry()` for metrics.
- **No `@SpringBootTest`** here — that makes it an integration test (10× slower).
- Assert with AssertJ: `assertThat(x).isEqualTo(…)`, `assertThatThrownBy(() -> …).isInstanceOf(NotFoundException.class)`.
- Verify side effects only when they *are* the behaviour (`verify(orderRepository).save(any())`,
  `verifyNoInteractions(...)` for "rejected before touching the DB").
- Method names: `method_condition_expectedResult` (matches existing tests).

Reference: `src/test/java/am/foodme/backend/service/OrderServiceTest.java`.
Run: `cd apps/backend && ./gradlew test --tests '*OrderServiceTest'`.

## 4. What to cover (in this order)

1. The happy path that the change/feature is about.
2. Boundaries: 0, 1, min, min±1, max, empty list, `null`/`undefined`, exact thresholds
   (`>` vs `>=` bugs live here — e.g. free-delivery threshold, minimum quantity).
   Several planted `FM-BUG-NN` defects sit exactly on these boundaries: if a boundary test fails
   next to a marker, report it / mark it with its ticket — don't fix it unless that is your task.
3. Error paths: not found, invalid input, rejected state transitions.
4. Every bug you fix gets a test named after the behaviour, with the Jira key in a comment.

## 5. Known bug, test must stay green

Write the **correct** expectation and mark it, with the ticket on the line above:

```ts
// SCRUM-7: decrement from min+1 deletes the line. Flip to it() once fixed.
it.fails("decrements from 2 to 1 instead of removing the line (SCRUM-7)", async () => { … });
```

Java: `@Disabled("SCRUM-7: <reason>")`. Never weaken the assertion to match buggy behaviour.

## 6. Done checklist

- [ ] Test file is colocated / mirrors the package; titles describe behaviour.
- [ ] Each test arranges its own data; passes alone and in any order.
- [ ] You ran it and saw it pass — **and** saw it fail once by breaking the code (proves it can fail).
- [ ] No sleeps, no `.only`, no assertion-free tests (the `test-quality` hook blocks these).
- [ ] `npx tsc -b` passes for web tests (test files are type-checked).
