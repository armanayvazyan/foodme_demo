# Testing rules

- Every bug fix must include a test that fails before the fix and passes after it.
- Never delete, skip (`.skip`, `@Disabled`) or weaken an existing test to make it pass.
- Tests must have real assertions. A test without `expect`/`assert` is not a test.
- No hard-coded waits (`waitForTimeout`, `Thread.sleep`) in tests.
- Unit tests: no network or database. E2E tests: Playwright, in the app's `e2e/` folder.
