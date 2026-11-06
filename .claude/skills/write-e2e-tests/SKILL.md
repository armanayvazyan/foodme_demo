---
name: write-e2e-tests
description: Write Playwright end-to-end tests for foodme_demo web and admin apps. Use when asked for e2e, UI, browser or user-flow tests.
---
# Writing e2e tests (Playwright)

## 1. Look first
- Read `playwright.config.ts` in the app (baseURL, test folder, web server).
- Read existing specs in the app's `e2e/` folder and reuse their helpers, page objects and login steps.

## 2. Write the test from the user's point of view
- One user flow per test, for example "add a dish to the cart, increase quantity, checkout".
- Put it in `apps/<app>/e2e/<feature>.spec.ts`.

## 3. Locators (in this order of preference)
1. `page.getByRole('button', { name: 'Add to cart' })`
2. `page.getByLabel(...)`, `page.getByText(...)`
3. `page.getByTestId(...)`. If a needed element has no good locator, add a `data-testid` to the component.
Never use long CSS or XPath selectors.

## 4. Waiting
- Use Playwright's auto-waiting assertions: `await expect(locator).toBeVisible()`, `toHaveText`, `toHaveCount`.
- Never use `page.waitForTimeout()`.

## 5. Independence
- Each test starts from a clean state (fresh page, clear storage if needed).
- Don't depend on another test running first.

## 6. Run and verify
- Run only the new spec: `npx playwright test e2e/<feature>.spec.ts` from the app folder.
- If it fails, open the trace or report (`npx playwright show-report`) and fix the cause, not by adding waits.
- Run it 3 times (`--repeat-each=3`) to make sure it isn't flaky.

## Done when
- [ ] Test follows the user flow and uses role/label locators
- [ ] No `waitForTimeout`
- [ ] Passed 3 times in a row, and you showed the output
