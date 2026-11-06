---
paths:
  - "apps/backend/src/test/**"
  - "apps/*/e2e/**"
  - "apps/web/src/**/*.test.ts"
  - "apps/web/src/**/*.test.tsx"
---

# Testing rules

- Use the matching skill: `write-unit-tests` for one function or class,
  `write-integration-tests` for backend endpoints through MockMvc, and
  `write-e2e-tests` for anything through the browser.
- A regression test must fail against the buggy code before it passes against
  the fix. Run it both ways.
- To run the existing suites, use the `run-regression` skill and its script
  rather than calling each test command by hand.
- Make test data unique (UUID or timestamp in emails), and never depend on
  test order or on totals other tests can change.
- In Playwright, never use `page.waitForTimeout`. Wait on a web-first
  assertion of the state you expect.
- Don't edit `flake-*.spec.ts` or tests marked `FM-FLAKE-*` unless that is the
  task: they are exercise material.
- Never report a test as passing if you couldn't run it. Say what stopped you,
  for example no JDK or no backend running.
