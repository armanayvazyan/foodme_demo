---
name: ft-plan
description: Use for step 02 of the functional-testing pipeline (/ft-plan <T>) - write runs/<T>/plan.md, the test plan for an approved spec.yaml (scope, partitions per AC, test data, environment, risks).
---

# Step 02: Test plan

Argument: `T`. Run dir `R = agentic-workflows/functional-testing/runs/<T>/`. You write only `R/plan.md`.

## Preconditions

Run `agentic-workflows/functional-testing/scripts/status.sh <T>`. Step 01 must be `done`, with no open questions and an approval. If not, end with `STATUS: BLOCKED: step 01 is not approved`.

## Read

- `R/spec.yaml`: acs, out_of_scope, answered questions, sut. The answers are part of the requirements now.
- The spec doc in `sources.doc` for shared facts (launch data, fees). Don't read app source code to decide what is correct: the app may be wrong.
- The live test data: find a chef and dishes to use with read-only GETs on the SUT's public API (`curl -s <sut>api/...`; endpoints in `apps/web/src/api/foodme.ts`). Note names and prices exactly.

## Write `R/plan.md`

Sections, short and concrete:

1. **Scope**: ACs in scope (ids). Out of scope (from spec.yaml) and anything else you won't test, with a reason.
2. **Approach per AC**: a table `AC | partitions / boundaries | technique | cases planned`. Use equivalence partitions and boundary values (below / at / above a minimum), state transitions (apply → replace → remove), and both delivery methods where an amount depends on them. Say which answered question settles each expected value.
3. **Test data**: the chef, dishes, quantities and the resulting subtotals for every partition, with the arithmetic. Reuse the same data where you can.
4. **Environment**: the SUT URL, the signed-in throwaway customer from `scripts/session.sh`, and the intentional noise to ignore (random 200–1500 ms API latency, heartbeat errors in GlitchTip, `/api/debug/boom`).
5. **Risks**: what could make a correct app look broken (latency, cold start, cart left over) and what could make a broken app look correct (asserting what the app shows instead of what the AC says).
6. **Exit criteria**: every AC covered by at least one case; every case executed; mismatches triaged.

Aim for about 8–14 cases in total. No duplicate partitions.

## End

Run `status.sh <T>`, then: `STATUS: NEEDS_HUMAN: review runs/<T>/plan.md and approve step 02` (or `BLOCKED: <reason>`).
