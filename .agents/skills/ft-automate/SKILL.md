---
name: ft-automate
description: Use for step 06 of the functional-testing pipeline (/ft-automate <T>) - turn the executed test cases of runs/<T>/spec.yaml into one Playwright spec apps/web/e2e/<t>-<slug>.spec.ts, or fix only the FAIL checks a test-judge verdict names.
---

# Step 06: Automate

Argument: `T`. Run dir `R = agentic-workflows/functional-testing/runs/<T>/`. You write one file, `apps/web/e2e/<t>-<slug>.spec.ts` (`<t>` = the key in lower case, e.g. `kan-27-promo-codes.spec.ts`), and in `spec.yaml` only each case's `status` and `spec`. Shared helpers go in a new `apps/web/e2e/<t>-*.ts` file if you need one. App code and config are off limits (the guard blocks them), and so is `e2e/auth.ts`.

## Preconditions

`agentic-workflows/functional-testing/scripts/status.sh <T>`: step 04 `pass` and step 05 `done`. The guard refuses the spec file otherwise.

If the latest `R/verdicts/07-*.json` is `fail` and not stale, this is a **retry**: fix exactly the checks with `result: FAIL`, nothing else.

## Read first

- `R/spec.yaml` (cases), `R/execution.md` (what the page really looked like: labels, roles, waits).
- `.agents/rules/web.md`, the Playwright part of `.agents/skills/test-review/SKILL.md`, and `agentic-workflows/functional-testing/rubrics/tests.md`: the test judge checks against these.
- `apps/web/e2e/auth.ts` and `apps/web/playwright.config.ts`.

## Rules

- **One `test()` per case**, titled with the case id first: `test("KAN-27-TC-03: <case title>", ...)`.
- **Assert the case's `expected`, not what step 05 observed.** If a case mismatched in 05, its test must fail on the current app. That's the point: never "fix" a test to match the app.
- Every amount and message in an assertion comes from that case's `expected`. Don't assert anything no case states.
- Locators: `getByRole`, `getByLabel`, `getByText`. Use `{ exact: true }` where a name is a prefix of another (e.g. `getByLabel("Promo code", { exact: true })` vs the **Remove promo code** button). No `data-testid`, CSS classes or `nth()` on structure.
- Web-first assertions only: `await expect(locator).toHaveText(...)`, `toBeVisible()`, `toContainText(...)`. No `waitForTimeout` (the API has a random 200–1500 ms delay on purpose; retrying assertions handle it).
- Sign in with `createAccountAtCheckout(page, name)` from `./auth`. Each test makes its own customer and cart: `fullyParallel` is on.
- Relative URLs only (`page.goto("/chef/24")`); `baseURL` comes from `PLAYWRIGHT_BASE_URL`.
- No `test.only`, `test.skip`, `test.fixme`, `try/catch` around actions, or `if (visible)` branches.
- If a case places an order, put `FT <T> <case-id>` in the order note.

## Check

From `apps/web`, run `npx playwright test e2e/<file> --list`: the file must compile and list every case id. Don't run the suite against the SUT: that's step 08 (`scripts/run-tests.sh`).

Then set each automated case's `status: automated` and `spec: "<the exact test title>"`, run `node agentic-workflows/functional-testing/scripts/validate.mjs <T>` and `status.sh <T>`.

## End

List `case id → test title`. Then `STATUS: DONE` (next: the test judge) or `BLOCKED: <reason>`.
