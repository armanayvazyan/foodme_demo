---
paths:
  - "apps/web/e2e/**"
  - "apps/admin/e2e/**"
  - "apps/web/playwright.config.ts"
  - "apps/admin/playwright.config.ts"
---

# Testing: frontend e2e (web and admin)

Playwright, Chromium only. There are no unit tests in the SPAs.

```bash
cd apps/web   && npm run test:e2e        # dev server on :5180, fullyParallel
cd apps/admin && npm run test:e2e        # dev server on :5174, serial (fullyParallel: false)
cd apps/web   && npm run test:e2e:all    # both suites
npx playwright test e2e/happy-path.spec.ts -g "test name"
npx playwright show-report
```

- **Backend required.** The suites need a running backend with the Flyway seed, at `:8081` unless `VITE_API_BASE_URL` is set. Playwright only starts the Vite dev server.
- **Remote targets.** Run against a deployed instance with `PLAYWRIGHT_BASE_URL=https://…` (web) or `ADMIN_BASE_URL=https://…/backoffice` (admin). Expect free-tier cold starts and the simulated 200 ms+ API latency. Use web-first assertions (`expect(...).toBeVisible()`), not fixed waits.
- **Locators.** Use roles and labels (`getByRole`, `getByLabel`) as the existing specs do. Shared helpers, such as creating an account at checkout with a unique email, are in `apps/web/e2e/auth.ts`.
- **Test data.** Tests create their own customers with unique `e2e-<timestamp>-<rand>@example.com` emails. Don't assume a clean DB.
- **Flaky by design.** `flake-*.spec.ts` are intentionally flaky, for the flaky-test lesson. Don't stabilise or delete them.
- **Planted defects.** Some specs assert planted-defect behaviour. For example, `layout.spec.ts` expects one chef to drop off the last page because of FM-BUG-02. Keep these as they are unless asked.
- **CI behaviour.** CI sets `forbidOnly` and retries (web 2, admin 1). Traces are recorded on the first retry.
