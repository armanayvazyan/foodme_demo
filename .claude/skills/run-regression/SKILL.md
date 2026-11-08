---
name: run-regression
description: Run the FoodMe regression suite (backend unit+integration, web unit, web E2E, admin E2E), triage every failure as real bug / known bug / flaky / environment, and report it — optionally filing or updating Jira. Use before a merge or release, after a risky change, when the user asks to "run all tests", "run regression", "is main green?", or to check which known bugs are still open.
---

# Run regression

## 1. Preflight (30 s)

```bash
curl -sf localhost:8081/actuator/health && echo backend UP || echo backend DOWN
git status --short | head; git rev-parse --abbrev-ref HEAD
```

- Backend down and E2E wanted → it needs Postgres (`foodme`/`foodme` on :5432, see `.env.example`),
  then `cd apps/backend && ./gradlew bootRun`, or pass `--start-backend` to the script.
  No Postgres available → run `--skip-e2e` and say E2E was not run. Never report E2E as passing when it was skipped.
- Web/admin dev servers are started by Playwright automatically.

## 2. Run

Delegate to the **test-runner** subagent (keeps hundreds of log lines out of the main context),
or run directly:

```bash
./scripts/regression.sh                       # all four suites, ~3–4 min
./scripts/regression.sh --skip-e2e            # backend + web unit only, ~1 min
./scripts/regression.sh --only web-e2e --grep checkout
```

Output: `test-results/regression/summary.md` (table + failure list), per-suite `*.log`, Playwright
`*.json`, backend JUnit XML, traces under each app's `test-results/`. Exit code 1 = something failed.

Environment knobs: `PW_CHROMIUM_PATH` (use a preinstalled Chromium when Playwright's bundled
build is missing), `GRADLE_ARGS` (e.g. an `--init-script` with a Maven mirror when Central rate-limits).

## 3. Triage every failure — exactly one bucket each

| Bucket | How to tell | Action |
|---|---|---|
| **Known bug** | Test or nearby code references a Jira key / `FM-BUG-NN`; matches an open ticket | Note the key. If the ticket is *Done* but the test still fails → reopen candidate (report it). |
| **Flaky** | Passes on rerun: `npx playwright test <file>:<line> --repeat-each=10` fails only sometimes | Report as flaky with failure rate; check `FM-FLAKE-NN` markers; do **not** call the run green. |
| **Environment** | Connection refused, missing browser, port in use, 429 from Maven, missing `/backoffice` build | Fix setup or report as not-run. Not a product bug. |
| **New regression** | Fails deterministically, no ticket | Find the cause with `git log -p --since=… -- <files>`; reproduce with a lower-level test if possible. |

Known environment-only case: `happy-path.spec.ts › admin can login and list orders after a storefront checkout`
expects the admin SPA bundled into the backend at `/backoffice` (Docker/Render build). Against
`./gradlew bootRun` it fails at the final `goto` — classify as environment.

Rerun only what failed, to confirm the bucket:
```bash
cd apps/web && npx playwright test --last-failed --retries=0
cd apps/backend && ./gradlew test --tests '*OrderControllerTest'
```

## 4. Report

Paste the summary table, then one line per failure: `bucket — test — cause — Jira key/next step`.
State plainly what did **not** run. Example:

```
backend 26/26 ✅ · web-unit 26 + 1 known-fail ✅ · web-e2e 20/22 ❌ · admin-e2e 7/7 ✅
- known bug — storefront-flows › cart quantity decrease keeps item at minimum — FM-BUG-07 still in useCart.ts — SCRUM-7 is "Done": reopen?
- environment — happy-path › admin can login… — /backoffice not bundled under bootRun
```

## 5. Jira (only when the user asks, or confirms)

Use the `jira` skill: search for an existing issue first (`text ~ "<test title>"` or label),
comment on it with the new evidence; create a Bug only for a **new regression**, with the failing
test path, error line and trace path. Never close or transition tickets from a regression run.
