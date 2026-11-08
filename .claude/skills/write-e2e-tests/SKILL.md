---
name: write-e2e-tests
description: Write reliable Playwright end-to-end tests for the FoodMe storefront (apps/web/e2e) and admin back-office (apps/admin/e2e). Use for user journeys (browse → cart → checkout → order status, admin order handling), UI regressions, reproducing a bug reported from the UI, or fixing a flaky E2E test. Not for logic that a unit or MockMvc test can cover faster.
---

# Write E2E tests (Playwright)

E2E tests are the slowest and most fragile layer. Write one only for a **user-visible journey**
or a bug that only reproduces in the browser. Everything else belongs lower in the pyramid.

## Setup facts

| | web (storefront) | admin |
|---|---|---|
| Specs | `apps/web/e2e/*.spec.ts` | `apps/admin/e2e/*.spec.ts` |
| Base URL | `PLAYWRIGHT_BASE_URL` (default `http://localhost:5180`) | `ADMIN_BASE_URL` (default `:5174`) |
| Dev server | started by Playwright (`webServer`) | same |
| Parallel | `fullyParallel: true` | serial |
| API | `VITE_API_BASE_URL` (default `http://localhost:8081`) | same |

The **backend must be running** on :8081 with Flyway seed data (Postgres). Check:
`curl -sf localhost:8081/actuator/health`. The `run-regression` skill explains how to start it.
If the bundled Playwright browser is missing, set `PW_CHROMIUM_PATH` to a local Chromium.

## Selectors — in this order of preference

1. `page.getByRole("button", { name: "Add to cart" })`, `getByLabel("Email")`, `getByText(...)`
2. Scope to a region first: `const cart = page.locator("aside.uc-panel"); cart.getByRole(...)`
3. Existing stable component classes (`a.cc_card`, `button.dc_card`, `.cic_root`) — acceptable,
   already used across specs. Never use generated/Tailwind utility classes, `nth-child` chains or XPath.
4. `.first()` / `.nth(i)` only on lists where any item is valid.

Copy text from `apps/web/src/locales/en/translation.json` rather than guessing labels.

## Waiting — never sleep

`page.waitForTimeout` is blocked by a hook. Use web-first assertions; they retry until timeout:

```ts
await expect(cart.locator(".cic_root")).toHaveCount(1);       // instead of sleep-then-count
await expect(page).toHaveURL(/\/orders\/success/);
await Promise.all([page.waitForResponse(/\/api\/order$/), page.getByRole("button", { name: "Place order" }).click()]);
await expect.poll(async () => (await request.get(url)).status()).toBe(200);
```

A dialog/modal that animates in: assert it is visible (`await expect(dialog).toBeVisible()`)
before clicking inside it. This is exactly how to fix the seeded `FM-FLAKE-01`.

## Test data

- Create what you need through the API, not the UI, unless the UI step *is* the behaviour:
  `registerCustomerViaApi(request, API)` and API order creation (see `apps/admin/e2e/admin-flows.spec.ts`).
- Unique emails per test (`Date.now()` + random). Never depend on another test's data or order.
- Reuse helpers in `apps/web/e2e/auth.ts` (`createAccountAtCheckout`); add new shared helpers there.
- Read real ids from the API (`/api/chef/active`, `/api/chef/{id}`) instead of hard-coding them.

## Template

```ts
import { test, expect } from "@playwright/test";

test.describe("Checkout", () => {
  test("takeaway order shows the order number", async ({ page }) => {
    await page.goto("/explore");
    await page.locator("a.cc_card").first().click();
    await page.locator("button.dc_card").first().click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.locator("aside.uc-panel").getByRole("link", { name: "Go to checkout" }).click();
    // ...
    await expect(page.getByText("Order placed!")).toBeVisible();
  });
});
```

## Known bug in a journey
Keep the correct assertion and mark it with the ticket on the line above:
`// SCRUM-7: …` then `test.fail("...", async …)`. It goes red when fixed — remove the marker then.

## Flaky test triage
1. Reproduce: `npx playwright test e2e/x.spec.ts:12 --repeat-each=20 --workers=4`.
2. Read the trace of a failing run: `--trace=retain-on-failure`, then `npx playwright show-trace <zip>`.
3. Typical causes here: clicking before a modal/animation settles, asserting before IndexedDB
   writes land (reload right after add-to-cart), shared data between parallel tests.
4. Fix the race. Never add retries, sleeps or longer global timeouts as the fix.

## Run

```bash
cd apps/web
npx playwright test e2e/storefront-flows.spec.ts           # one file
npx playwright test -g "takeaway"                          # by title
npx playwright test --headed --debug e2e/x.spec.ts:20      # step through (local only)
npx playwright show-report                                 # HTML report
```

## Done checklist
- [ ] Couldn't be a unit/integration test instead.
- [ ] Role/label selectors, scoped to a region; no sleeps; no hard-coded localhost in `goto`.
- [ ] Own data via API; passes with `--repeat-each=5` and in parallel.
- [ ] Watched it fail once (break the expectation) to prove it can fail.
