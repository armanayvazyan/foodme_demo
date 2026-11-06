---
name: write-unit-tests
description: Write unit tests for foodme_demo. Use when asked to add, fix or improve unit tests, or when a change in apps/web, apps/admin or apps/backend needs unit test coverage.
---
# Writing unit tests

## 1. Check the setup first
Work on a feature branch, never on `main`.

**Frontend.** Run all commands from the app folder (`apps/web` or `apps/admin`).
- Use Node 22, the version in `apps/backend/Dockerfile`. Vitest fails on older versions, for example with `does not provide an export named 'styleText'`. If Node 22 isn't available, don't change the system install; use a temporary copy and say so.
- Run `npm ci` if `node_modules` is missing.
- `apps/web` uses Vitest. Read `src/hooks/useCart.test.ts` and copy its style.
- `apps/admin` has no unit test runner. Add Vitest as a separate change and report it to the user: add a `test` script, set `test.include` to `src/**/*.test.{js,jsx}` so it doesn't pick up the Playwright specs in `e2e/`, and commit the updated lockfile.

**Backend** (`apps/backend`). Use JUnit 5 and Mockito, in `src/test/java`, in the same package as the class under test. Don't copy the existing `*ControllerTest` classes: they start Spring and use a database, so they are integration tests.

## 2. Where to put the test
- Frontend: next to the file, named `<file>.test.ts` (for example `src/hooks/useCart.test.ts`).
- Backend: `<ClassName>Test.java`.
- Use one `describe` per function.
- Use Vitest's default Node environment for plain functions. Use `jsdom` only to test a hook like `useCart()` itself.

## 3. What to test
Cover the cases that apply to this function, and list any you skipped with the reason:
- the normal case
- edge cases: empty input, zero, minimum and maximum values, missing item
- the error case. If the function has no error handling, test one failure at most, or say none applies.

Test states the types forbid only if the code explicitly handles them.

Test one behaviour per test. A behaviour can need several assertions: checking that the right write happened and the wrong one didn't is one behaviour. Name tests as sentences, like `"removes the item when quantity reaches the minimum"`.

### Code marked `FM-BUG-NN`
These bugs are seeded for the course, so a marker doesn't tell you whether the bug is still live. Check the code and `git log` first.
- **Fixed:** add a regression test that names the ID.
- **Live:** don't fix it, and don't write a test that expects the wrong behaviour. Report it and ask how to proceed.

## 4. How to write it
- Arrange, Act, Assert: set up data, call the function once, check the result.
- Mock everything external: database, `fetch`, API calls. Use `vi.mock` on the frontend and Mockito on the backend.
- No network, no real database, no `sleep` or timers.
- Every test must have at least one real assertion.
- Real storage behaviour, including `fake-indexeddb`, belongs in the `write-integration-tests` skill.

## 5. Run and verify
- Frontend: `npx vitest run <path-to-test-file>`.
- Backend: `./gradlew test --tests "ClassNameTest"`, from `apps/backend`.
- Bug fix: confirm the test fails without the fix.
- Existing code: copy the source file aside, break the logic, confirm a test fails, then restore the copy. Don't restore with `git checkout`, which would also discard uncommitted work.
- Lint: `npm run lint` (oxlint in web, ESLint in admin).
- `apps/web`: run `npm run build`. It type-checks test files too, so a type error there fails the deploy.
- If dependencies changed, confirm `npm ci` still works.

## Done when
- [ ] Tests are in the right place and follow existing style
- [ ] Applicable cases are covered, and skipped cases are listed with the reason
- [ ] Tests ran and passed, and you showed the output
- [ ] A test failed when the logic was broken, and the source is restored
- [ ] Lint passes, and `npm run build` passes in `apps/web`
- [ ] Any setup change (new dependency, config, Node workaround) is reported to the user

## Example from this project

Mocking the database used in `apps/web/src/hooks/useCart.ts`. Use typed `vi.fn` mocks through `vi.hoisted`, so the type-check covers your mock data. With `vi.mocked(db.products.get)`, an incomplete cart item still passes the type-check.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ICartItem } from "@/types";
import { decrementCartItem } from "./useCart";

const products = vi.hoisted(() => ({
  get: vi.fn<(uid: string) => Promise<ICartItem | undefined>>(),
  update: vi.fn<(uid: string, changes: Partial<ICartItem>) => Promise<number>>(),
  delete: vi.fn<(uid: string) => Promise<void>>(),
}));

vi.mock("@/lib/db", () => ({ db: { products } }));

function cartItem(quantity: number, minQuantity = 1): ICartItem {
  return {
    id: 10,
    uid: "a",
    chefId: 1,
    nameEn: "Dolma",
    price: 2500,
    url: "/api/images/dolma.jpg",
    quantity,
    limitations: { minQuantity },
  };
}

describe("decrementCartItem", () => {
  beforeEach(() => vi.resetAllMocks());

  it("decreases quantity by 1 when above the minimum", async () => {
    products.get.mockResolvedValue(cartItem(3));

    await decrementCartItem("a");

    expect(products.update).toHaveBeenCalledWith("a", { quantity: 2 });
    expect(products.delete).not.toHaveBeenCalled();
  });

  it("removes the item when quantity equals the minimum", async () => {
    products.get.mockResolvedValue(cartItem(2, 2));

    await decrementCartItem("a");

    expect(products.delete).toHaveBeenCalledWith("a");
    expect(products.update).not.toHaveBeenCalled();
  });
});
```

## Common mistakes
- Don't guess the test runner: `apps/web` uses Vitest, and `apps/admin` has none yet.
- Always test the boundary where `quantity` equals `minQuantity` (see FM-BUG-07 in `useCart.ts`).
- Reset mocks in `beforeEach` with `vi.resetAllMocks()`. `vi.clearAllMocks()` keeps return values set with `mockResolvedValue`, so they can leak into the next test.
- Mock `db`, never use the real IndexedDB in a unit test.
