---
name: write-e2e-tests
description: Write Playwright end-to-end tests for the FoodMe storefront (apps/web) and admin back office (apps/admin) that drive a real browser against a real backend, covering cart, checkout, sign-in, orders and admin flows. Use this whenever the task is to test what a user sees or clicks, reproduce a UI bug as a test, add a regression test for a page, or fix a flaky Playwright test — even if the request just says "test the cart" or "add a UI test". For logic in one function, use write-unit-tests; for API-only checks, use write-integration-tests.
---

# Write end-to-end tests

An e2e test opens the app in Chromium, clicks through it like a customer or
admin, and checks what's on screen. It's the only kind of test that catches
bugs in the wiring between UI, cart storage and API, and also the slowest and
most fragile, so keep each one focused on a user-visible behaviour.

## Where tests go

| App | Folder | Dev server Playwright starts | Shared helpers |
|---|---|---|---|
| Storefront | `apps/web/e2e/*.spec.ts` | Vite on port 5180 | `apps/web/e2e/auth.ts` |
| Admin | `apps/admin/e2e/*.spec.ts` | Vite on port 5174 | `loginAsAdmin`, `createOrderViaApi` in `admin-flows.spec.ts` |

Add to an existing spec when the flow fits its `test.describe`, for example
cart behaviour in `storefront-flows.spec.ts`. Otherwise create
`<feature>.spec.ts`. Files named `flake-*.spec.ts` are teaching material
about flaky tests, so don't use them as style examples.

## A backend must be running

Playwright starts the frontend, not the backend. The API comes from
`VITE_API_BASE_URL` (default `http://localhost:8081`). Pick one:

- **Local backend:** run `./gradlew bootRun` in `apps/backend` with PostgreSQL
  available. This is the safe default.
- **Live Render backend:** for read-only flows (browsing, cart, layout), you
  can point the dev server at the deployed API, whose CORS allows any origin:

  ```bash
  VITE_API_BASE_URL=https://foodme-nairamnatsakanyan.onrender.com npm run test:e2e -- storefront-flows.spec.ts
  ```

  The cart lives in the browser, so cart tests write nothing to the server.
  Tests that register customers or place orders **do** write to the live
  database, so don't run those against Render unless the person agrees. The
  first request after the service sleeps can take a few minutes.

Some specs build API URLs from a hard-coded `http://localhost:8081` rather than
`VITE_API_BASE_URL`; those only work against a local backend.

## How to write the test

### Reach the page the way a user does

Most storefront tests start from the explore page:

```ts
await page.goto("/explore");
await page.locator("a.cc_card").first().click();
await expect(page).toHaveURL(/\/chef\/\d+/);
```

Don't hard-code chef or dish IDs. Seed data differs between local and Render,
so pick the first chef or dish, or create what you need through the API.

### Choose stable selectors

In order of preference:

1. **Role and accessible name:** `getByRole("button", { name: "Increase quantity" })`.
   The app sets `aria-label` on icon buttons (`Decrease quantity`,
   `Increase quantity`, `Remove item`, `Add <dish> to cart`, `Cart, <n> items`),
   so use those.
2. **Label:** `getByLabel("Email")` for form fields.
3. **The app's own class hooks**, already used across the suite:
   `a.cc_card` (chef card), `button.dc_card` (dish card), `aside.uc-panel`
   (cart panel), `.cic_root` (cart item), `.fm-qty-grp p` (quantity value).

Avoid Tailwind utility classes such as `.text-zinc-400` and nth-child chains.
They change with styling and break tests for reasons unrelated to behaviour.

Scope locators to the area you mean. The cart panel and the page can both
contain "Increase quantity", so use `cart.getByRole(...)` with
`const cart = page.locator("aside.uc-panel")`.

### Wait on state, never on time

Use web-first assertions, which retry until they pass or time out:

```ts
await expect(cart.locator(".fm-qty-grp p")).toHaveText("1");
await expect(cart.locator(".cic_root")).toHaveCount(0);
```

Never use `page.waitForTimeout(...)`. A fixed sleep is too short on a slow
machine and wasted time on a fast one, and it's the most common cause of
flaky tests in this repo. After an action, wait for the result it should
produce before taking the next step, for example the item appearing in the
cart before a reload.

### Create test data through the API

Signing up through the UI in every test is slow. When the flow under test
isn't sign-up itself, use `registerCustomerViaApi(request, API)` from
`apps/web/e2e/auth.ts`, or `createOrderViaApi` in the admin suite. Always make
emails unique (`Date.now()` plus a random number, as the helpers do), because
tests run in parallel and the database keeps old accounts.

### Assert what the user would notice

Check the visible outcome: the quantity shown, the item count, the total, a
message, the URL. For a regression test, assert the exact thing the bug
report says went wrong, plus the boundary next to it.

This example uses `addFirstDishToCart`, a helper defined at the top of
`storefront-flows.spec.ts`. It isn't exported, so write the test in that file
or copy the helper. It also assumes the first dish has a minimum quantity of 1,
which holds for the current seed data. This test was run against the live
API: it passed 3 times out of 3 on the fixed code and failed on the FM-BUG-07
version.

```ts
test("minus at one above minimum keeps the item", async ({ page }) => {
  const cart = await addFirstDishToCart(page);
  await cart.getByRole("button", { name: "Increase quantity" }).click();
  await expect(cart.locator(".fm-qty-grp p")).toHaveText("2");

  await cart.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(cart.locator(".fm-qty-grp p")).toHaveText("1");

  await cart.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(cart.locator(".cic_root")).toHaveCount(0);
});
```

## Run

From the app's folder:

```bash
npm run test:e2e -- storefront-flows.spec.ts          # one file
npm run test:e2e -- -g "minus at one above minimum"   # one test by name
npm run test:e2e -- --repeat-each=5 <file>            # check for flakiness
npx playwright show-report                            # open the last HTML report
```

Before you call a new test done, run it with `--repeat-each=5`. A test that
passes once and fails one time in five will waste far more time later than it
takes to fix now.

## Before you finish

- The test passes repeatedly, and fails against the buggy code if it's a
  regression test.
- It doesn't depend on other tests, a fixed ID, or a specific amount of data.
- You said which backend it ran against (local or Render), and if you couldn't
  run it, said so plainly instead of reporting it as passing.
