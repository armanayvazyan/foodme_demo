---
name: ft-report
description: Use for step 10 of the functional-testing pipeline (/ft-report <T>, or /ft-report <T> push after approval) - write runs/<T>/report.md (coverage, case and test results, defects, judge findings), and push the cases and results to Qase project FOODME only after a human approved step 10.
---

# Step 10: Report

Argument: `T`, optionally `push`. Run dir `R = agentic-workflows/functional-testing/runs/<T>/`. You write `R/report.md`, and in push mode each case's `qase_id` in `spec.yaml`. Qase project code: **FOODME**.

## Mode 1: report (`/ft-report <T>`)

`agentic-workflows/functional-testing/scripts/status.sh <T>`: steps 01–08 must be done, and 09 approved or `not_needed`. Otherwise `STATUS: BLOCKED: <the step that isn't>`.

Read `spec.yaml`, `execution.md`, `results.json`, `state.json`, `verdicts/`, the latest `triage-<k>.md`, `filed.md` if present, and the rows of `runs/findings.jsonl` for this run. Use only what these files say; don't re-test or re-judge anything.

Write `R/report.md`:

1. **Summary**: one paragraph. Is the feature ready? Name the blocking defects.
2. **Coverage**: `AC | cases | manual (05) | automated (08)` with ✅ / ❌ / ⏸ per cell.
3. **Cases**: `case | title | 05 result | test | 08 result`.
4. **Defects**: from triage: classification, main hypothesis with its evidence ids, the skeptic verdict, Jira key from `filed.md` (or "not filed").
5. **Questions answered**: each Q-n with its answer and who answered.
6. **Judges**: per judge step, verdicts in order with model, turns, tokens, plus each non-PASS finding (check, category, item) and the human decision if `findings.jsonl` has one.
7. **Not tested**: out-of-scope items and blocked cases, with reasons.

No customer PII; quote logs only as the triage file did.

End: `STATUS: NEEDS_HUMAN: review runs/<T>/report.md and approve step 10 to push it to Qase`.

## Mode 2: push (`/ft-report <T> push`)

1. `status.sh <T>`: step 10 must have an approval. If not, `STATUS: BLOCKED: step 10 is not approved` (the guard blocks Qase writes anyway).
2. `qase_project_context` with code `FOODME` to find or choose the suite (one suite per ticket, titled `<T> <feature>`; create it with `qase_suite_upsert` if missing).
3. Cases without `qase_id`: create them all in **one** `qase_case_bulk_create` call. Title `<case id>: <title>`, classic steps (one per `steps` item, the last carries `expected_result: <expected>`), `automation: "Automated"` if the case has a `spec`, tags `[<T>, functional-testing]`. Write each returned id back as `qase_id` in `spec.yaml`, in order.
4. One `qase_ci_report`: title `<T> functional testing <date>`, one result per case: `passed` if its test passed in `results.json`, `failed` (with the error as `comment`, `defect: true`) if it failed, `blocked` if the case was blocked; the triage file name and Jira key in `comment`.
5. Append the Qase run id and link to `report.md` under **Qase**.

If a Qase call fails (e.g. 401: no `QASE_API_TOKEN`), stop: `STATUS: BLOCKED: Qase <error>`. Don't retry with other tools.

End: `STATUS: DONE`.
