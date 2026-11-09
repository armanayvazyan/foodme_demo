---
paths: apps/*/e2e/**
---
- Use getByRole, getByLabel or getByTestId locators. Avoid new CSS-class selectors.
- Never use waitForTimeout. Wait for a condition: await expect(locator).toBeVisible()
- One test = one user flow. Tests must not depend on each other.
- Reuse helpers from apps/web/e2e/auth.ts. Create test users with unique emails.
- Test title starts with an ID: FM-<ticket>-<nn>
