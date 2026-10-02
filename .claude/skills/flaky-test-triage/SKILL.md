---
name: flaky-test-triage
description: Diagnose why a Playwright or JUnit test in FoodMe passes and fails intermittently, classify the root cause, and propose (or apply, if asked) a deterministic fix. Use for "this test is flaky", "fails on CI only", "passes on retry".
---

# Flaky test triage

## 1. Prove it's flaky

```bash
# Playwright (apps/web or apps/admin), backend must be running on :8081
npx playwright test e2e/<file>.spec.ts --repeat-each=20 --workers=4 --reporter=line

# JUnit (apps/backend)
for i in $(seq 1 10); do ./gradlew test --tests '<Class>' --rerun -q || echo "FAIL run $i"; done
```

Record the failure rate (e.g. 3/20). If 0 failures, try `--workers=1` vs many,
and CI-like conditions (`CI=1`) before concluding.

## 2. Classify the cause

| Symptom | Likely cause | Deterministic fix |
|---|---|---|
| Passes alone, fails in parallel | shared data (same email, same cart) | unique data per test; API setup |
| `waitForTimeout` nearby | timing guess | web-first `expect(...).toBe...` on the real signal |
| Fails right after reload/navigation | IndexedDB/query not settled | assert the persisted UI state before acting |
| Order-dependent JUnit (`@Order`) | state leaks between tests | make each test create its own data |
| Time/`LocalDateTime.now()` assertions | clock / timezone | inject a `Clock` or assert a range |
| Random backend latency | `foodme.latency.*` | wait on response (`page.waitForResponse`) not on time |

Look for `FM-FLAKE-NN` markers — those are planted for teaching.

## 3. Report / fix

- Report: test name, failure rate before, classified cause, evidence
  (trace: `npx playwright show-trace test-results/**/trace.zip`).
- Only change the test if the user asked for a fix. For `FM-FLAKE-*`, keep the
  marker and add `FIX:` explaining what changed (see
  `apps/web/e2e/flake-cart-persistence.spec.ts`).
- After fixing, rerun step 1 and report the failure rate after (must be 0/20).
  Never "fix" flakiness by adding retries or longer timeouts alone.
