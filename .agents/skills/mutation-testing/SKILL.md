---
name: mutation-testing
description: Use when asked to run mutation testing, check how strong the FoodMe backend tests really are, find code the tests execute but never verify, or demo "green tests are not good tests" to students. Optional args: a target class or package (default OrderService) and a mutant count (default 10).
---

# Mutation testing (agent-driven)

Mutation testing checks the tests, not the code. You plant one small bug (a **mutant**) in production code and run the suite:

- tests fail → mutant **KILLED** (good, the tests caught the bug)
- tests pass → mutant **SURVIVED** (a gap: this bug could ship with a green build)

**Mutation score = killed / (killed + survived)**. Unviable mutants (compile errors) don't count.

Scope: `apps/backend` only. It is the only app with tests that run without a live server.

## The test command

Use the same command for the baseline and for every mutant. Run it from `apps/backend`:

```bash
./gradlew cleanTest test --offline 2>&1 | tee build/mutation-testing/<ID>.log | grep -E "FAILED|tests completed|BUILD|error:"
```

- `cleanTest` makes Gradle re-run the tests even when it thinks nothing changed.
- `tee` keeps the full log for each run. The `grep` keeps Spring's JSON logs out of your context.
- Drop `--offline` only if the log says a dependency isn't cached.
- Set the Bash tool `timeout` to the per-mutant timeout from step 0.

How to read the output:

| Output | Status |
|---|---|
| `BUILD SUCCESSFUL` | SURVIVED (or PASS for the baseline) |
| `Class > method() FAILED` lines + `N tests completed, M failed` | KILLED |
| `error:` lines + `Execution failed for task ':compileJava'` | UNVIABLE |
| The Bash tool timed out | KILLED (timeout). Run `./gradlew --stop` before the next mutant. |

## 0. Setup

1. **Target.** A class name (`OrderService`) resolves to its file under `apps/backend/src/main/java`, found with `find -name OrderService.java`. For a package, split N across its classes in proportion to their line count, and skip classes that have no logic.
2. **Clean tree.** `git status --porcelain apps/backend/src` must be empty. If it isn't, **stop** and ask the user to commit or stash. Every revert below uses `git checkout`, which would wipe their changes.
3. **Output folder.** Create `apps/backend/build/mutation-testing/` (git-ignored) and empty it.
4. **Baseline.** Run the test command with ID `baseline`. It must show `BUILD SUCCESSFUL`. If it doesn't, stop: you can't measure tests against a red suite. Note how many seconds it took. The per-mutant timeout is `max(60, 5 × baseline)` seconds.
5. **Read first.** Read the target and the tests that exercise it before you choose any mutants. Note which test methods carry a `// FM-FLAKE-nn` comment just above them. They're the course's known-flaky tests.

## 1. Off-limits (never mutate)

- Lines tagged `// FM-BUG-nn` and the whole statement after the tag, even when it spans several lines. These are planted course bugs.
- The intentional demo behaviour listed in `CLAUDE.md` (`SimulatedLatencyConfig`, `FlakyHeartbeatJob`, `/api/debug/boom`, `HttpLoggingFilter`).
- Test code, `src/test/resources`, Flyway migrations, DTO field names and API paths.
- Logging, metrics (`meterRegistry`), and comments. Tests can't observe them, so those mutants teach nothing.

## 2. Plan the mutants up front

Write `build/mutation-testing/plan.md` before you run anything. List **N mutants plus 3 spares** (spares replace unviable ones). For each, give an ID, `Class.method:line`, category, before → after, and a realistic-bug note.

- Each mutant is **one** small edit to **one** statement.
- Line numbers always refer to the **original** file. A revert happens between mutants, so they don't drift.
- Put the most mutants in methods with branches, math or validation. Methods that only delegate (a single `findBy…` and a map) get at most one.
- Use at least 4 categories. No two mutants may share a line and an operator.

| Category | Operator examples |
|---|---|
| Conditional boundary | `>` ↔ `>=`, `<` ↔ `<=` |
| Negate conditional | `==` ↔ `!=`, drop a `!`, `equals` → `!equals` |
| Math | `+` ↔ `-`, `*` ↔ `/`, drop a `+= x` |
| Return value | return `null`, `0`, empty list, `false`, a constant |
| Void call removed | delete `order.setX(...)`, `repository.save(...)` |
| Constant | `"NEW"` → `"PAID"`, `100000` → `100001`, `50` → `5` |
| Guard removed | delete an `if (...) throw ...` validation |

The **realistic-bug note** is one line about the developer mistake the mutant simulates, e.g. "free-delivery threshold off by one cent", "forgot to persist the receiver phone".

## 3. Loop: one mutant at a time

For each mutant `M01…Mnn`:

1. **Mutate.** Make the single edit with `Edit`. Show it as `- old` / `+ new` (a deletion has only the `-` line).
2. **Save the diff.** `git diff -U1 -- <file> > build/mutation-testing/Mnn.diff`
3. **Run** the test command with ID `Mnn`.
4. **Classify** with the table above. Then apply the flaky rule: if **every** failing test is an `FM-FLAKE` test, the status is **KILLED (weak)**. It still counts as killed, but the report must call it out. These tests fail on test order or timing, not on behaviour, so a rerun doesn't settle anything.
5. **Revert.** `git checkout -- <file>`, then confirm `git status --porcelain apps/backend/src` is empty. Never start the next mutant while the tree is dirty.
6. **Record.** Create `build/mutation-testing/ledger.md` with this header if it doesn't exist yet, then append one row:
   ```
   | ID | Location | Category | Change | Status | Killing tests | Seconds |
   |---|---|---|---|---|---|---|
   ```
7. **Tick.** Print one line: `M03 ✅ KILLED by OrderControllerTest.createOrder_nonCashPayment_rejectedWithBadRequest (6s)`. Use ❌ for SURVIVED, ⚠️ for KILLED (weak), and ⛔ for UNVIABLE. For UNVIABLE, take the next spare.

If anything interrupts the loop (error, user stop), revert first: `git checkout -- apps/backend/src/main`.

## 4. Report

Write `apps/backend/build/mutation-testing/report.md` in this order, then print the summary and the survivors table in chat:

1. **Summary**:
   - target, mutants run, and killed / weak / survived / unviable counts
   - **mutation score %**, plus the score with weak kills counted as survivors
   - wall-clock runtime from baseline to last revert

   No coverage tool is configured, so argue "executed but not verified" from the code. Example: "every order test runs `createOrder`, none reads back the receiver fields".
2. **Results by category**: killed/total per category.
3. **Survivors and weak kills** (most important first): for each one, give the diff, the realistic-bug note, **why** the tests missed it (no test reaches it, or a test reaches it but asserts nothing about it), and a concrete test that would kill it (name in `action_condition_expectedResult` form plus the assertion).
4. **Killed**: compact table of each mutant and the test that caught it.
5. **Unviable**: which mutants didn't compile and why.
6. **Takeaways**: two or three sentences for students about what this test suite really protects.

Then offer to write tests that kill the survivors (use the `backend-tests` skill), and to rerun only those mutants afterwards so the score visibly goes up.

## Common mistakes

| Mistake | Fix |
|---|---|
| Two edits in one mutant | One edit per mutant. Otherwise you can't tell which edit was caught. |
| Starting the next mutant before the revert | Check `git status` after every revert. |
| Mutating `FM-BUG` lines | They're course material. Skip them. |
| Counting compile errors as kills | They're UNVIABLE. Take a spare. |
| Counting an `FM-FLAKE`-only failure as a full kill | Mark it KILLED (weak) and report it with the survivors. |
| Reading the full Gradle output | Use the `grep` filter. The full log is in `<ID>.log`. |
| Calling a survivor "equivalent" to get out of it | Call it equivalent only when no input can tell the two versions apart, and explain why. |
