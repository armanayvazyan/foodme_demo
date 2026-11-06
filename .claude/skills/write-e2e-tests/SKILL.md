---
name: write-e2e-tests
description: Write Playwright end-to-end tests for the FoodMe storefront (apps/web) or back office (apps/admin) that drive a real browser against the real backend. Use when the user asks for e2e, UI, browser, Playwright, user-flow, or smoke tests, or wants a scenario like "order a dish" or "admin changes order status" automated.
---

# Write e2e tests (Playwright)

E2e tests drive Chromium through the real UI against the **real backend on :8081** and its real data. `.claude/rules/testing-frontend.md` loads automatically for `e2e/` files and covers commands and config. This skill is the workflow.

| | Storefront `apps/web` | Back office `apps/admin` |
|---|---|---|
| Specs | `apps/web/e2e/*.spec.ts` | `apps/admin/e2e/*.spec.ts` |
| Dev server | :5180 (auto-started) | :5174 (auto-started) |
| Parallel | yes (`fullyParallel: true`) | **no**: serial, specs share backend data |
| Routing | `/explore`, `/chef/:id`, `/checkout`, `/orders`, `/login` | hash routes: `/#/login`, `/#/orders` … |
| Helpers | `e2e/auth.ts` (`createAccountAtCheckout`, `registerCustomerViaApi`) | `loginAsAdmin`, `createOrderViaApi` in `admin-flows.spec.ts` |

## Step 0: Before writing

1. Make sure the backend is running: `curl http://localhost:8081/actuator/health`. If it isn't up, tell the user. Postgres + backend are needed (see AGENTS.md "Running everything locally").
2. Write the scenario as user steps and expected outcomes first. One spec = one user goal.
3. Read the page and component source to find accessible names: button text, labels, `aria-label`, headings. The English strings come from `apps/web/src/locales/en/translation.json`.
4. Read the existing specs and reuse their helpers instead of duplicating them.

## Writing the spec

```ts
import { test, expect } from "@playwright/test";
import { createAccountAtCheckout } from "./auth";

test.describe("Checkout", () => {
  test("customer places a takeaway order", async ({ page }) => {
    await page.goto("/explore");
    await page.locator("a.cc_card").first().click();
    await expect(page).toHaveURL(/\/chef\/\d+/);
    // ... act like a user ...
    await expect(page.getByRole("heading", { name: /order/i })).toBeVisible();
  });
});
```

**Locators, best first:** `getByRole(role, { name })` → `getByLabel` → `getByText` → `getByTestId`. Scope with a container (`page.getByRole("form", { name: "Checkout" })`, `page.locator("aside.uc-panel")`). Existing specs use some CSS classes (`a.cc_card`, `button.dc_card`, `.cic_root`); reuse those where there's no accessible alternative. Don't add `data-testid` to app code unless the user agrees.

**Waiting:** the backend adds **200–1500 ms of random latency to every API call**.
- Use web-first assertions only: `await expect(locator).toBeVisible()`, `toHaveText`, `toHaveURL`, `toHaveCount`.
- **Never** use `page.waitForTimeout`, and never read state without an `expect` (for example `const n = await locator.count()` followed by an `if`).
- If you need to wait for a specific response, use `page.waitForResponse(r => r.url().includes("/api/order") && r.ok())`, set up **before** the click that triggers it.

**Test data and isolation**
- Create what you need. Register a unique user with a `Date.now()` + random suffix (see `auth.ts`). Set up preconditions **through the API** (`request` fixture, `registerCustomerViaApi`, `createOrderViaApi`) instead of clicking through the UI, unless the UI flow is what's being tested.
- Never depend on another test having run first, or on exact counts that other tests (or students using the same DB) can change.
- The storefront cart lives in IndexedDB per browser context, so each test starts with an empty cart.
- Admin specs mutate shared data and run serially. Keep them independent anyway: create a fresh order, then act on *that* order (find it by its number).

**API base inside specs:** `process.env.VITE_API_BASE_URL || "http://localhost:8081"` (the same pattern as `admin-flows.spec.ts`).

## Flaky and planted-bug specs

- `apps/web/e2e/flake-*.spec.ts` are **intentionally flaky** teaching examples. Don't copy their patterns, and don't "fix" them unless asked.
- If a flow hits a planted `FM-BUG-NN` (for example FM-BUG-02: the chef list drops one chef on the last page; FM-BUG-08 in admin `OrderShow`), assert the **intended** behavior. If it fails, report it with the bug id, and ask the user whether to keep it failing, `test.fail()` / `test.skip()` it with the id in the title, or assert the current behavior with a comment (as `layout.spec.ts` does).

## Run, then prove it isn't flaky

```
cd apps/web     # or apps/admin
npx playwright test e2e/<file>.spec.ts
npx playwright test e2e/<file>.spec.ts --repeat-each=5    # stability check, web only (admin is serial/stateful)
npx playwright show-report                                 # on failure; traces are recorded on the first retry
npx playwright test e2e/<file>.spec.ts --trace on          # force a trace when debugging locally
```
A new spec isn't done until it passes repeatedly. Report the actual results, including any failure caused by a planted bug or a backend that wasn't running.
