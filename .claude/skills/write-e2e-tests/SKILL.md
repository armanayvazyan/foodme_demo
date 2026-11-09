---
name: write-e2e-tests
description: Write end-to-end Playwright tests that follow a real user
  flow in the browser for the web storefront or the admin panel. Use when
  the user asks for e2e tests, UI tests, Playwright tests or a user-flow test.
---
1. Read the ticket and AC. List the user flows before writing code. Never invent AC.
2. Choose the app: apps/web/e2e/ (storefront) or apps/admin/e2e/ (admin). File name <feature>.spec.ts
3. Read one existing spec in that folder first (for example cart-decrement.spec.ts) and copy its style.
4. Locators: getByRole, getByLabel, getByTestId. No waitForTimeout. Wait with expect(...).
5. One test = one user flow. Tests do not depend on each other.
6. Reuse helpers from apps/web/e2e/auth.ts. Create users with unique emails.
7. Title format "FM-<ticket>-<nn>: ..." and a comment "AC: <number>".
8. Run: cd apps/<web|admin> && npx playwright test <file>. The backend must run on :8081.
   If the backend is not reachable, report NOT RUN. Never edit apps/*/src.
Output: a table "Test ID | AC covered | Result".
