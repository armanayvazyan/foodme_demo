---
name: write-unit-tests
description: Write fast, isolated unit tests for FoodMe code, using JUnit 5 and Mockito for backend services and Vitest for storefront logic (cart, utils, schemas). Use this whenever the task is to test a single function, class, hook or service in isolation, to add a regression test for a logic bug, or when someone says "unit test" — even if they don't name a framework. For HTTP endpoints, use write-integration-tests instead; for flows through the browser, use write-e2e-tests.
---

# Write unit tests

A unit test checks one piece of logic with everything around it faked. It
should run in milliseconds and fail for exactly one reason. If you need a
database, an HTTP call or a browser to test something, that test belongs in
`write-integration-tests` or `write-e2e-tests` instead.

## Pick the target

| Code | Unit-testable? | Tool |
|---|---|---|
| Backend services in `apps/backend/.../service/` | Yes | JUnit 5 + Mockito, no Spring context |
| Backend utils, DTO mapping, `security/JwtService` | Yes | JUnit 5 |
| Web logic: `src/hooks/useCart.ts`, `src/lib/*.ts`, `src/schemas/*.ts` | Yes | Vitest (see the setup note below) |
| Web React components | Usually not worth it | Cover them with Playwright |
| Admin app (`apps/admin`) | No runner exists | Cover it with Playwright |

## Backend: JUnit 5 + Mockito

`spring-boot-starter-test` already provides JUnit 5, Mockito and AssertJ, so
there is nothing to install.

- Put service tests in `apps/backend/src/test/java/am/foodme/backend/service/`,
  named `<ClassName>Test`. Using the same package as the class lets the test
  reach package-private members without making them public.
- Services use constructor injection, so build the service yourself with mocks.
  Don't use `@SpringBootTest` here: starting Spring makes a unit test take
  seconds and hides which dependency the behaviour depends on.
- Mock every repository and collaborator. `MeterRegistry` can be a real
  `new SimpleMeterRegistry()`, which is simpler than mocking it.
- Name tests `method_condition_expectedResult`, matching the existing classes.

```java
package am.foodme.backend.service;

import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.repository.DishRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DishServiceTest {

    @Mock
    private DishRepository dishRepository;

    @Test
    void getDishById_missingDish_throwsNotFound() {
        when(dishRepository.findById(99L)).thenReturn(Optional.empty());
        DishService service = new DishService(dishRepository);

        assertThrows(NotFoundException.class, () -> service.getDishById(99L));
    }
}
```

Run it from `apps/backend` (needs JDK 17):

```bash
./gradlew test --tests '*DishServiceTest'
```

## Web: Vitest

The storefront has no unit test runner yet. The first time you need one, read
[references/web-vitest-setup.md](references/web-vitest-setup.md) and set it up.
Adding dev dependencies changes `package.json` and the lockfile for everyone,
so say you're doing it, and keep the setup in its own commit.

- Name tests `<file>.test.ts` next to the code, inside `src/`.
- Import with the `@/` alias, as the app code does.
- For anything that touches the cart, import `fake-indexeddb/auto` first and
  clear `db.products` in `beforeEach`, so tests don't leak cart rows into each other.
- Seed `db.products` directly instead of going through `addDishToCart`, unless
  `addDishToCart` is the thing under test. That keeps each test about one function.

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { decrementCartItem } from "@/hooks/useCart";

beforeEach(async () => {
  await db.products.clear();
});

it("lowers the quantity when it is one above the minimum", async () => {
  await db.products.add({
    id: 1, uid: "1-1-", chefId: 1, nameEn: "Lavash Wrap", price: 1800,
    url: "/img/dish/1.jpg", quantity: 2, limitations: { minQuantity: 1 },
  });
  await decrementCartItem("1-1-");
  expect((await db.products.get("1-1-"))?.quantity).toBe(1);
});
```

Run from `apps/web`:

```bash
npm test
```

## What to test

- **Boundaries first.** Most bugs here are off-by-one: quantity at the minimum
  and one above it, an empty list, a missing translation, a zero subtotal.
  Test both sides of each boundary.
- **One behaviour per test**, with a name that states it. A reader should know
  what broke from the test name alone.
- **Assert outcomes, not calls.** Prefer checking the returned value or the
  stored state over `verify(...)` on a mock. Verifying calls ties the test to
  the implementation, so it breaks on harmless refactors.
- **Regression tests must fail first.** When the test is for a bug, run it
  against the buggy code and see it fail before you apply the fix. A test that
  passes either way protects nothing.

## Before you finish

- The new tests pass, and the rest of the suite still passes.
- For web, `npm run build` still passes too, because `tsc -b` type-checks test
  files under `src/`.
- You didn't change production code just to make it testable unless the task
  asked for it. If something can't be tested without a change, say so.
