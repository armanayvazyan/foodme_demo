---
name: run-regression
description: Run the full regression test suite for foodme_demo (unit, integration and e2e tests for web, admin and backend) and report the results. Use when asked to run regression, run all tests, check that nothing is broken, or before merging or releasing.
---
# Running regression tests

Scope: $ARGUMENTS (if empty, run everything; can be `web`, `admin`, `backend` or `e2e`).

## 1. Check the starting point
- Run `git status` and `git branch --show-current` and note them in the report.

## 2. Run every suite, fastest first
Run all suites in scope. If one fails, keep going and run the rest.

| Suite | Folder | Command |
|---|---|---|
| Backend unit + integration | `apps/backend` | `./gradlew test` |
| Web unit + integration | `apps/web` | `npx vitest run` |
| Admin unit + integration | `apps/admin` | `npx vitest run` |
| Web e2e | `apps/web` | `npx playwright test` |
| Admin e2e | `apps/admin` | `npx playwright test` |

If a folder has no tests for a suite, write "no tests" instead of failing.

## 3. Check failures
- Re-run each failed test once on its own.
  - Fails again: **real failure**
  - Passes the second time: **flaky**
  - Can't start (missing dependency, port in use, no browser): **environment problem**
- Do NOT change code or tests during regression. Only report.

## 4. Report
Write the report to `regression-report.md` in the project root and show it:

```markdown
# Regression report - <date and time>
Branch: <branch>

| Suite | Passed | Failed | Skipped | Time |
|---|---|---|---|---|

## Failures
- <test name> - real / flaky / environment - <one-line reason> - <file:line>

## Verdict
PASS (safe to merge) or FAIL (list what must be fixed)
```
