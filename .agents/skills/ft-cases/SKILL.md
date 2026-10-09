---
name: ft-cases
description: Use for step 03 of the functional-testing pipeline (/ft-cases <T>) - write the test cases into runs/<T>/spec.yaml from the approved plan, or fix only the FAIL checks a case-judge verdict names.
---

# Step 03: Test cases

Argument: `T`. Run dir `R = agentic-workflows/functional-testing/runs/<T>/`. You write only `test_cases` in `R/spec.yaml`. Never change `acs`, `out_of_scope` or `questions`.

## Preconditions

Run `agentic-workflows/functional-testing/scripts/status.sh <T>`. Step 02 must be approved. If not: `STATUS: BLOCKED: step 02 is not approved`.

If the latest `R/verdicts/04-*.json` has verdict `fail` and is not stale, you are on a **retry**: go to "Fixing a judge FAIL".

## Write the cases

Read `R/spec.yaml`, `R/plan.md` and the doc in `sources.doc`. One case per row of the plan's "cases planned".

```yaml
test_cases:
  - id: KAN-27-TC-01            # <T>-TC-nn, two digits, in order
    title: "SAVE10 100 AMD below its minimum is rejected with the missing amount"
    covers: [AC-3]
    blocked_by: []              # questions this case depends on (must be answered)
    steps:
      - "Open <sut>chef/24 (Alans Kitchen), signed in as the session customer, with an empty cart"
      - "Add 1 × Curry Rice with Eggs (2,900 AMD) to the cart"
      - "Go to checkout"
      - "Type SAVE10 in Promo code and press Apply"
    expected: "The page shows \"Add 100 AMD more to use this code\"; no discount line"
    expected_source: AC-3       # the AC or the answered Q-n the expected value comes from
    status: draft
```

Rules (the case judge checks them, see `agentic-workflows/functional-testing/rubrics/cases.md`):

- **expected comes from the sources, never from the app.** Only facts that follow from `expected_source`, the launch data, the shared setup and arithmetic. No UI wording, colours, toasts or layout the sources don't state. Message texts must be the AC's text, with placeholders filled in.
- If a value needs a rule only an answered question gives (e.g. whether delivery is discounted), `expected_source` is that `Q-n` and it goes in `blocked_by`.
- Concrete data in every step: chef, dish names, quantities, prices, code, delivery method. No "a valid code" or "some items".
- One input partition per case. Don't test anything in `out_of_scope`.
- Every AC is covered by at least one case.
- `status: draft`. No `execution`, `spec` or `qase_id`.

## Fixing a judge FAIL

Read the latest verdict. For each check with `result: FAIL`, fix exactly what its `reason` and quotes name. Don't touch cases or fields the verdict didn't fail; don't reword passing cases. A C2 FAIL (missing question) is not yours to fix: end with `STATUS: NEEDS_HUMAN: the case judge says a question is missing (<quote>); add it to questions via step 01`.

UNSURE checks are for the human, not you.

## Check

Run `node agentic-workflows/functional-testing/scripts/validate.mjs <T>` until it prints `valid`. Then `status.sh <T>`.

## End

Print the coverage table from the validator, then `STATUS: DONE` (next: the case judge), or `BLOCKED`/`NEEDS_HUMAN` with the reason.
