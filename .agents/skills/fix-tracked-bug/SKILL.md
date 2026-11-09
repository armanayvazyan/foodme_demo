---
name: fix-tracked-bug
description: Reproduce, fix and verify a bug tracked in Jira (project KAN) for the FoodMe app, from the ticket through the Render deploy. Use when asked to reproduce, fix, retest or close a FoodMe bug or KAN ticket.
---

# Fix a tracked bug

Work through these steps in order. Each step says what counts as done.

## 1. Understand the ticket

- Read the Jira ticket: steps, expected and actual results. The
  `work-with-jira` skill covers finding and reading it.
- Find the code path it describes. `AGENTS.md` lists where things live.
- Run `git log -- <file>` on the file. A bug may have been fixed before and
  reintroduced, and the earlier fix shows the intended behaviour.

**Done when:** you can name the file and line, and why it misbehaves.

## 2. Reproduce it

- Reproduce the bug on the live site
  (https://foodme-nairamnatsakanyan.onrender.com) or on a local run, following
  the ticket's steps.
- Record what you saw: each step and the resulting state. For UI bugs, read the
  DOM state rather than relying only on a screenshot.
- If it doesn't reproduce, stop and report that instead of changing code.

**Done when:** you have seen the bug happen, not just read it in the code.

## 3. Fix it

- Make the smallest change that fixes the reported behaviour. Leave other bugs
  alone and report them, since this repository has planted defects for other
  exercises.
- Add a test that fails without the fix, at the lowest level that shows the
  bug: `write-unit-tests` for logic in one function, `write-integration-tests`
  for an endpoint, `write-e2e-tests` when the bug only shows in the browser.
  Run the test against the buggy code first and see it fail.
- Run the app's build and lint, and the new test.
- Run the `run-regression` skill to check the fix didn't break anything else.

**Done when:** the build passes, the new test fails before the fix and passes
after it, and the regression run has no new failures.

## 4. Ship it

- Commit with a Conventional Commit message that names the ticket, for example
  `fix(web): keep cart item when decrementing above minimum quantity` with
  `Fixes KAN-4.` in the body.
- Push to `main` only when the person asks. Render deploys `main` automatically
  and that changes the live site. Otherwise, use a branch and a pull request.

**Done when:** the commit is on GitHub, on `main` or in an open pull request.

## 5. Verify the deploy

- Wait for Render's GitHub deployment for the commit to reach `success`.
- Confirm the live site serves the new build: the `assets/index-*.js` name in
  the page changes with each web build.
- Repeat the reproduction steps on the live site, plus the boundary case next
  to the bug (for example both "one above minimum" and "at minimum").

**Done when:** the live site behaves correctly in the reproduction and the boundary case.

## 6. Close the ticket

Use `work-with-jira` for the comment format and the transition IDs.

- Add a comment with the fix commit, the deploy, and a before-and-after table of
  the retest. Say what was not covered.
- Move the ticket to Done only when the person asks, and only after step 5.

**Done when:** the ticket records the evidence and has the status the person asked for.
