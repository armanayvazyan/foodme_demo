---
paths:
  - "apps/web/e2e/**"
  - "apps/admin/e2e/**"
  - "apps/web/playwright.config.ts"
  - "apps/admin/playwright.config.ts"
---

# Frontend e2e testing rules (web & admin)

Both apps use Playwright with Chromium only. There are no unit or component tests in either frontend.

## Commands
```
# apps/web
npm run test:e2e                         # dev server on :5180, parallel
npx playwright test e2e/happy-path.spec.ts
npx playwright test -g "test title"
npm run test:e2e:all                     # web, then admin

# apps/admin
npm run test:e2e                         # dev server on :5174 (--strictPort), serial
npx playwright test e2e/admin-flows.spec.ts
```
- Playwright starts the Vite dev server itself, or reuses one that's already running outside CI.
- **The backend must already be running on :8081.** The e2e tests hit the real API with real seed data.
- To test a deployed instance, set `PLAYWRIGHT_BASE_URL` (web) or `ADMIN_BASE_URL` (admin).
- HTML reports are written to `playwright-report/` and don't open automatically. Traces are recorded on the first retry. Under `CI`, web retries twice and admin once.

## Things to know when writing or debugging specs
- The backend adds a random 200–1500 ms delay to every API call. Wait for UI state with web-first assertions (`expect(locator).toBeVisible()` and similar), never fixed timeouts.
- Web auth helpers are in `apps/web/e2e/auth.ts`.
- The admin suite runs serially (`fullyParallel: false`) because its specs change shared backend data.
- The web cart is stored in IndexedDB, so it is isolated per browser context.
- `apps/web/e2e/flake-*.spec.ts` are **intentionally flaky** teaching examples. Don't "stabilize" them unless asked.
- Some specs assert on planted-bug behavior. For example, `layout.spec.ts` expects FM-BUG-02, where the chef list drops one chef on the last page. If a planted bug gets fixed, update the matching assertion.
