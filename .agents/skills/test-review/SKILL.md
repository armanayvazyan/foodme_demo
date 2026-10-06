---
name: test-review
description: Review the tests in a FoodMe pull request (or local diff) for quality and coverage. Posts inline comments on weak or wrong tests and one PR comment listing the tests that are missing. Use when asked to review tests, check test coverage of a PR, or run from the Claude Test Review workflow.
---

# Test review

Two outputs:

1. **Inline comments** on test lines that are wrong, weak or flaky.
2. **One PR comment** listing the tests the change still needs.

You review tests only. Don't comment on production code style or bugs unless a test is wrong because of them.

## 0. Input

- Argument is `owner/repo/pull/<n>`, a PR number, or nothing.
- With a PR: get the diff with `gh pr diff <n>` and the file list with `gh pr view <n> --json files,title,body`. Don't use `git diff`: CI checkouts are shallow.
- Without a PR: review `git diff main...HEAD` plus uncommitted changes, and print both outputs in the terminal instead of posting.
- Read the full changed files with `Read`, not only the hunks. A test is judged against the code it tests, so read that code too.

## 1. Classify changed files

| Area | Production code | Tests |
|---|---|---|
| backend | `apps/backend/src/main/**` | `apps/backend/src/test/**` (JUnit 5, MockMvc, H2 `test` profile) |
| web | `apps/web/src/**` | `apps/web/e2e/*.spec.ts` (Playwright) |
| admin | `apps/admin/src/**` | `apps/admin/e2e/*.spec.ts` (Playwright) |

Ignore docs, CI, rules, skills, lock files and config for coverage purposes. Flyway migrations need a note (H2 tests don't run them), not a test.

## 2. Review each changed test

Backend house style is in `.agents/skills/backend-tests/SKILL.md`. Read it and judge backend tests against it. Flag a test when it:

**Doesn't prove anything**
- asserts only `status().isOk()` / `toBeVisible()` where a business outcome (total, status, which items appear, error `$.message`) is the point;
- has no assertion, or asserts on the value it just set up;
- mocks the class under test, or mocks so much that the real logic never runs;
- would still pass if the behaviour it names were broken (try mentally reverting the production change).

**Is fragile or flaky**
- depends on test order, global row counts, generated IDs or list order that isn't documented (the backend Spring context and H2 DB are shared across all classes);
- mutates seed rows from `data.sql`, or reuses fixed emails/usernames instead of `UUID`-unique data;
- compares against the wall clock without tolerance;
- Playwright: uses `waitForTimeout`/fixed sleeps, non-retrying checks (`expect(await x.count())` instead of `await expect(x).toHaveCount()`), or brittle CSS chains where a role/label/text locator exists. Remember `SimulatedLatencyConfig` adds 200–1500 ms to every API call, so any timing assumption is a flake.

**Breaks repo conventions**
- backend: not `action_condition_expectedResult` naming, hand-written JSON strings instead of `objectMapper.writeValueAsString(Map.of(...))`, non-literal API paths, `@TestMethodOrder`/`@Order`, new dependencies for things `spring-boot-starter-test` already has;
- web: adds `data-testid` attributes (forbidden by `web.md`);
- renames API fields or paths in a test (the contract is frozen, see `CLAUDE.md`).

**Don't flag**
- tests or specs marked `FM-FLAKE-nn`, or `flake-*.spec.ts`: they are intentionally flaky course material;
- `GET /api/debug/boom` always failing, latency, heartbeat failures: intentional demo behaviour;
- pure style nits that don't change what the test proves.

Only flag what you are confident about. Each inline comment says what's wrong, why it matters, and a concrete fix (a code suggestion when short).

## 3. Find missing tests

For every changed behaviour in production code, decide whether a test in the PR (or an existing test you checked with `Grep`) covers it. Use the coverage list in `backend-tests` §4:

1. happy path;
2. each validation / `BadRequestException` branch, with its message;
3. not found (404 + message);
4. authorisation: anonymous → 401, wrong role → 403;
5. boundaries: minimum counts, empty lists, paging edges, INACTIVE chefs/dishes hidden.

For a bug fix, there must be a regression test that would fail without the fix. For a UI change to a user flow, expect a Playwright spec change or a reason it isn't needed.

Each missing test gets: the file to put it in, a suggested test name, and one line on what it asserts.

## 4. Post results

### Inline comments (PR mode)

Use `mcp__github_inline_comment__create_inline_comment` once per finding, on the test file line (right side of the diff, line numbers from the new file). Only comment on lines that are part of the diff. If a finding is about an unchanged line, put it in the summary comment instead.

Body format:

```
**Test review:** <problem in one sentence>

<why it matters, one or two sentences>

<fix, or a ```suggestion block>
```

### Summary comment (PR mode)

Write the body to a file (e.g. `/tmp/test-review.md`) and post it with `gh pr comment <n> --body-file /tmp/test-review.md`. Post exactly one comment. Template:

```markdown
## 🧪 Test review

**Verdict:** <Tests look good | Tests need work | Tests missing>

### Missing tests
| Area | Behaviour not covered | Add to | Suggested test |
|---|---|---|---|
| backend | cancelling an order that is already DELIVERED returns 400 + message | `OrderControllerTest` | `cancelOrder_alreadyDelivered_rejected` |

<or "None. The change is covered.">

### Test quality
<N> inline comment(s) on test code. <one-line summary, or "No issues found.">

### Notes
<Flyway migration not exercised by H2, e2e not run in CI (`RUN_E2E`), etc. Omit if empty.>
```

### Local mode

Print the inline findings as `path:line: <problem>. <fix>.`, then the summary in the same template. Post nothing.
