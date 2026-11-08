---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "apps/backend/src/test/**"
---

# Test conventions (all layers)

Enforced by `.claude/hooks/test-quality.mjs` — a write that adds any of these is blocked.

| Never | Do instead |
|---|---|
| `test.only` / `it.only` / `describe.only` | `npx playwright test -g "<title>"`, `npx vitest run -t "<title>"` |
| `page.waitForTimeout(n)`, `await new Promise(r => setTimeout(r, n))`, `Thread.sleep` | wait on a condition: `await expect(loc).toBeVisible()`, `toHaveCount`, `page.waitForResponse`, `expect.poll` |
| `test.skip` / `fixme` / `it.fails` / `@Disabled` without a ticket | add `// SCRUM-123: why` on the line above (Java: `@Disabled("SCRUM-123: why")`) |
| A test with no assertion | assert the observable outcome (`expect`, `assertThat`, `andExpect`, `verify`) |
| `expect(true).toBe(true)`, `assertTrue(true)` | assert on a value produced by the code under test |
| Empty `catch {}` in a test | `await expect(p).rejects…`, `assertThatThrownBy(…)` |
| Per-file `test.describe.configure({ retries })` | fix the race; retries are CI-only in `playwright.config.ts` |
| `page.goto("http://localhost:…")` | `page.goto("/route")` — baseURL comes from config/env |

## Always
- One behaviour per test; the title states it ("removes the line when decrementing at the minimum").
- Arrange data inside the test (or a factory). Never depend on another test's leftovers or on run order.
- Unique data per run: `` `e2e-${Date.now()}-${Math.random()}@example.com` `` (see `apps/web/e2e/auth.ts`).
- Known bug and you need the suite green? Write the *correct* expectation and mark it
  `it.fails(...)` / `test.fail()` with the Jira key. It flips red when the bug is fixed — then remove the marker.
- Run the test you wrote, and watch it fail once (break the code or the assertion) to prove it can fail.
