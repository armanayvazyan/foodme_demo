---
name: functional-testing
description: Use when asked to test a Jira feature ticket end to end (requirements → cases → manual run → Playwright spec → triage → report), or to find out where a functional-testing run stands and what to do next. Entry point only; each step has its own ft-* skill.
---

# Functional testing pipeline

This skill explains the pipeline and tells the user the next command. **It does not run any step itself.** Every step runs in a fresh session so no step trusts another step's memory: the files under `agentic-workflows/functional-testing/runs/<T>/` are the only hand-over.

Design rule: **skills write, subagents judge (read-only), scripts decide, humans approve.**

## What to do

1. Get the ticket key `T` (e.g. `KAN-27`). If the user gave none, ask.
2. Run `agentic-workflows/functional-testing/scripts/status.sh T`. If the scripts' `node_modules` is missing, run `npm ci --prefix agentic-workflows/functional-testing/scripts` first.
3. Show the user the step table and the **next command** exactly as printed. Say who runs it: an agent session, a script, or the human.
4. If the next command is a human approval, explain what to review and that only they can run `scripts/approve.sh` in their own terminal. You are blocked from running it.

End with `STATUS: DONE` (or `BLOCKED: <reason>` if `status.sh` fails).

## The steps

| # | Step | Runs as | Writes | Gate |
|---|---|---|---|---|
| 01 | Requirements | `/ft-requirements T` | `spec.yaml`: acs (word for word), out_of_scope, questions | human answers questions, approves |
| 02 | Test plan | `/ft-plan T` | `plan.md` | human approves |
| 03 | Test cases | `/ft-cases T` | `test_cases` in `spec.yaml` | `validate.mjs` passes |
| 04 | Case judge | `case-judge` agent (sonnet, read-only) | `verdicts/04-NN.json` (by hook) | pass; 2 retries, then human |
| 05 | Execute | `session.sh T`, then `/ft-execute T` with Playwright MCP | `execution.md`, `execution` per case | every case has a result |
| 06 | Automate | `/ft-automate T` | `apps/web/e2e/<t>-*.spec.ts` | guard: only after 04 pass + 05 done |
| 07 | Test judge | `test-judge` agent (sonnet, read-only) | `verdicts/07-NN.json` (by hook) | pass; 2 retries, then human |
| 08 | Run | `scripts/run-tests.sh T` | `results.json` | — |
| 09 | Triage | `/ft-triage T` (+ collectors, skeptic) | `triage-k.md` + bug draft | human approves before filing |
| 10 | Report | `/ft-report T` | `report.md` | human approves the Qase push |

Step 09 only runs when a case mismatched in 05 or a test failed in 08.

## Files nobody but scripts writes

`state.json`, `approvals.jsonl`, `results.json`, `verdicts/`, `evidence/`, `raw/`, `.auth/`, `runs/findings.jsonl`. The guard hook (`.agents/hooks/guard.mjs`) blocks the rest of us.
