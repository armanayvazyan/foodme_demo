---
name: run-regression
description: Run FoodMe's regression test suites (backend JUnit, storefront unit, storefront and admin Playwright) with one script, then read and report the results, separating real failures from flaky tests, skipped suites and environment problems. Use this whenever someone asks to run the tests, run regression, check nothing broke, verify a change or deploy, smoke-test the live site, or confirm a fix before closing a ticket — even if they just say "run the tests" or "is everything still working?". To write new tests, use the write-*-tests skills instead.
---

# Run regression

Regression means re-running the existing tests to check a change didn't break
something that used to work. The runner script does the running; your job is
to pick the right target, then read the results honestly.

## 1. Pick the target

| Target | What runs | Needs | Use it when |
|---|---|---|---|
| `local` (default) | Backend JUnit, storefront unit, all storefront e2e, all admin e2e | JDK 17, PostgreSQL and the backend on `localhost:8081` | Checking a change before you push it |
| `live` | Storefront unit, plus the read-only storefront e2e tests in `live-safe-tests.txt` | Nothing but Node | No local backend, or smoke-testing the deployed site |

In `live` mode the browser runs your **local** storefront code against the
**deployed** API. So it checks local frontend changes against the real backend,
but it doesn't test backend changes you haven't deployed.

Live mode never runs tests that register customers, log in or place orders,
because those would write to the real database. Don't work around that by
running other tests against Render unless the person agrees.

## 2. Run it

From the repository root:

```bash
.agents/skills/run-regression/scripts/run-regression.sh --target live
.agents/skills/run-regression/scripts/run-regression.sh --target local
.agents/skills/run-regression/scripts/run-regression.sh --suites backend,web-e2e
```

A live run takes about 2 minutes. The first request can take up to 3 more if
the Render service was asleep; the script waits for `/actuator/health` first.

The script prints one line per suite and writes everything to
`test-results/regression/<timestamp>/` (git-ignored):

- `summary.md`: the table, failing and flaky test names, warnings, and the
  overall result. Read this first.
- `<suite>.log`: full output for each suite, with error messages and stack traces.
- `<suite>.json`: Playwright's raw report.

| Exit code | Meaning |
|---|---|
| 0 | Every suite that ran passed (flaky tests count as passed but are listed) |
| 1 | At least one suite failed |
| 3 | Every suite was skipped, so nothing was tested |

## 3. Read the results

Sort each problem into one of these before reporting. They need different
responses, and reporting them all as "tests failed" hides what matters.

- **Failed:** the test failed on its first try and its retry. Open the suite's
  log and find the `Error:` lines. Then decide whether the change broke it or
  it was already broken: run the same suites on the base commit (for example
  in `git worktree add ../base main`) and compare. Only a test that passes on
  the base and fails with the change is a regression.
- **Flaky:** it failed, then passed on retry. That's not a regression, but
  name it in the report. Tests named `flake-*` or marked `FM-FLAKE-*` are flaky
  on purpose, as exercise material.
- **Skipped:** the suite didn't run, and the Notes column says why (no Java, no
  backend, no unit test runner yet). A skipped suite tells you nothing, so
  never count it as passing.
- **Environment:** many tests timing out on `toBeVisible` while waiting for
  chefs or dishes usually means a slow backend, not a bug. Live mode runs one
  worker at a time for this reason; with more workers the free Render instance
  times out. Rerun before you blame the code.

If `summary.md` has a **Warnings** section saying a title in
`live-safe-tests.txt` no longer matches, a test was renamed or removed. Fix the
list, because the run silently covered less than it should.

## 4. Report

Give the person:

1. The overall result and the target, for example "Live regression: 12 passed,
   0 failed, 0 flaky. Backend and admin suites were not run."
2. Each failure with its test name, the error in one line, and whether it's
   new or already failing on the base commit.
3. Flaky tests by name.
4. Skipped suites and why, so it's clear what wasn't tested.
5. The path to `summary.md`.

Never call a run green when suites were skipped, and never call a flaky test a
pass without naming it.

## Known gaps

- The storefront has no unit test runner yet, so `web-unit` is skipped until
  Vitest is set up (see `write-unit-tests`).

## Changing what live mode runs

`live-safe-tests.txt` lists exact Playwright test titles, one per line. Before
adding one, read the test and confirm it writes nothing to the server: no
`createAccountAtCheckout`, `registerCustomerViaApi`, admin login, "Place
order", or hard-coded `localhost:8081` API calls.
