---
name: write-unit-tests
description: Write fast, isolated unit tests for FoodMe — backend services/utilities with JUnit 5 + Mockito (no Spring context), or pure frontend logic in apps/web with Vitest. Use when the user asks for unit tests, tests for a single class/function, mocked service tests, or tests for utils/schemas/cart logic.
---

# Write unit tests

A unit test exercises **one class or function** with collaborators mocked or faked. No Spring context, no database, no HTTP, no browser. If the behavior you want to check needs any of those, use the `write-integration-tests` or `write-e2e-tests` skill instead.

## Step 0: Pick the target and read it

1. Read the class or function under test, plus the DTOs and models it uses.
2. Search it for `FM-BUG-` comments. These mark planted defects (see "Planted bugs" below).
3. List the behaviors to cover: the happy path, each branch or guard clause, boundary values (`>` vs `>=`, null, empty, zero), and each exception thrown.

## Backend (apps/backend): JUnit 5 + Mockito

Everything you need already comes with `spring-boot-starter-test` (JUnit 5, Mockito, AssertJ). **Don't add dependencies.**

**Location:** mirror the main package, for example
`apps/backend/src/test/java/am/foodme/backend/service/OrderServiceTest.java`.
(The existing integration tests live flat in `am.foodme.backend`. Unit tests go in sub-packages so the two kinds are easy to tell apart.)

**Template:**
```java
package am.foodme.backend.service;

import am.foodme.backend.dto.DeliveryPriceRequestDto;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Chef;
import am.foodme.backend.repository.*;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock OrderRepository orderRepository;
    @Mock ChefRepository chefRepository;
    @Mock DishRepository dishRepository;
    @Mock CustomerRepository customerRepository;

    OrderService service;

    @BeforeEach
    void setUp() {
        // Use a real SimpleMeterRegistry rather than mocking MeterRegistry: counters just work.
        service = new OrderService(orderRepository, chefRepository, dishRepository,
                customerRepository, new SimpleMeterRegistry());
    }

    @Test
    @DisplayName("delivery price is 0 for TAKEAWAY")
    void calculateDeliveryPrice_takeaway_isFree() {
        Chef chef = new Chef();
        chef.setDeliveryPrice(700.0);
        chef.setFreeDeliveryFrom(8000.0);
        when(chefRepository.findById(1L)).thenReturn(Optional.of(chef));
        // ...build request, call service, assertThat(result.getDeliveryPrice()).isZero();
    }

    @Test
    void calculateDeliveryPrice_unknownChef_throwsNotFound() {
        when(chefRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.calculateDeliveryPrice(/* request for chef 99 */ null))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("99");
    }
}
```
The template is a sketch. Before you write the real test, check the actual setter names, ID types (`Long` vs `Integer`) and constructor signatures in `model/` and `dto/`. Lombok generates most accessors.

**Conventions**
- Construct the service under test by hand, through its constructor. Don't use `@InjectMocks` when a collaborator should be real (like `SimpleMeterRegistry`).
- Use AssertJ (`assertThat`) for assertions. Use `verify(...)` only when the interaction itself is the behavior, for example "saves the order" or "never touches the repository when payment isn't CASH".
- Name tests `method_condition_expectedResult`. Add `@DisplayName` when it reads better.
- Use `@ParameterizedTest` + `@CsvSource` for boundary tables, for example subtotals just below, at and above `freeDeliveryFrom`.
- For `@Transactional` methods, unit-test the logic only. Transaction behavior belongs in integration tests.

**Good unit-test targets:** `service/*Service` (business rules, validation, pricing), `security/JwtService` (construct it with a test secret), `utils/ControllerUtil`, and DTO logic methods (for example `OrderDto`).

**Run** (from `apps/backend`; on Windows use `.\gradlew.bat`):
```
./gradlew test --tests 'am.foodme.backend.service.OrderServiceTest'
```

## Frontend (apps/web): Vitest

**Vitest is not installed yet.** Before you add it, tell the user it requires new devDependencies and get a yes. Setup, once approved:

```
cd apps/web
npm i -D vitest fake-indexeddb
```
Add `"test": "vitest run"` and `"test:watch": "vitest"` to the `package.json` scripts. Add a `test` block to `vite.config.ts` (and `/// <reference types="vitest/config" />` at the top):
```ts
test: {
  include: ["src/**/*.test.ts"],
  environment: "node",
},
```
Keep `e2e/` out of Vitest's `include`. Playwright owns those files.

**Location:** colocate tests with the code, as `src/lib/utils.test.ts` or `src/hooks/useCart.test.ts`.

**Good targets (pure logic, no rendering):**
- `src/lib/utils.ts`: `formatAmd` (rounding, thousands separators), `translate` (missing lang falls back to the first item, undefined input gives `""`), `sameLabel`
- `src/schemas/*.ts`: use zod `safeParse` to check valid and invalid payloads and the error paths
- `src/hooks/useCart.ts` cart functions (`addDishToCart`, `decrementCartItem`, …): add `import "fake-indexeddb/auto";` at the top and `await db.products.clear()` in `beforeEach`. Cover cases like the chef-mismatch `"mismatch"` result, `replaceOtherChef`, merging into an existing uid, and the min-quantity floor.

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDishToCart, decrementCartItem } from "@/hooks/useCart";

beforeEach(async () => { await db.products.clear(); });

describe("decrementCartItem", () => {
  it("keeps one item when decreasing from 2", async () => { /* ... */ });
});
```
Component rendering tests (React Testing Library + jsdom) need more dependencies. Only add them if the user asks.

**Admin (apps/admin):** it's thin react-admin glue with almost no pure logic. Prefer e2e there unless the user names a specific function.

## Planted bugs (FM-BUG-NN)

The repo contains deliberate defects for a QA course. When a test you're writing touches one:
1. Write the test against the **correct, intended** behavior (what the product should do).
2. Run it. If it fails because of the planted bug, **don't modify production code**. Report the failure and the FM-BUG id to the user.
3. Ask the user which they want: keep the test failing (it documents the bug), mark it `@Disabled("FM-BUG-NN …")` / `it.skip`, or assert the current buggy behavior with a comment (the convention used in `apps/web/e2e/layout.spec.ts`).

## Finish

- Run the new tests and show the pass/fail output. If anything failed, say what failed and why.
- Report what's covered and anything you deliberately left out.
