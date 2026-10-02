---
paths:
  - "apps/*/e2e/**"
  - "apps/*/playwright.config.ts"
---

# Playwright e2e rules

- Locators, in order of preference: `getByRole` → `getByLabel` →
  `getByText` → stable CSS class. Never XPath, never nth-child chains.
- Never use `page.waitForTimeout`. Wait on a web-first assertion
  (`await expect(locator).toBeVisible()`, `toHaveCount`, `toHaveURL`).
- Create data through the API (`request.post(`${API}/api/auth/register`)`)
  with unique emails so specs stay independent and parallel-safe
  (`fullyParallel: true`).
- One user journey per test; name it as the journey
  (`"explore -> chef -> add dish -> checkout -> success"`).
- Don't silently "fix" `FM-FLAKE-*` tests; they are teaching material.
- Files prefixed `flake-` are known-flaky demos; new stable tests go in
  descriptively named files (e.g. `checkout-validation.spec.ts`).
