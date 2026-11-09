---
name: run-regression
description: Run the full regression suite (backend tests, web e2e,
  admin e2e) and report the results. Use when the user asks to run
  regression, run all tests, or check that nothing is broken before a release.
---
1. Run in this order and stop if a stage cannot start (report why):
   a) cd apps/backend && ./gradlew test
   b) cd apps/web && npm run test:e2e      (needs the backend on http://localhost:8081)
   c) cd apps/admin && npm run test:e2e    (needs the backend on http://localhost:8081)
2. Never edit application code. Never delete, skip or weaken a test to make it pass.
3. Report a table: Stage | Passed | Failed | Skipped | Time.
   If a stage cannot run (backend not reachable, dependencies missing), write NOT RUN. Never count it as passed.
4. For every failure give: test name, file:line, error message, one-line guess of the cause.
   Mark it "possible app bug" or "possible flaky/test problem".
   Files named flake-*.spec.ts and comments FM-FLAKE-xx mark known flaky tests. Say so.
5. Re-run a failed test once to check if it is flaky. Report both results.
6. End with a verdict: GO or NO-GO, and the reason.
