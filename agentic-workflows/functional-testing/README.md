# Functional testing: agent-driven STLC with a human in the loop

Agents create. Judges check (read-only). You review and decide, in chat.

You never create or edit a file. Each step ends with the agent showing you what it made and asking **Approve / Request changes**. The agent records your decision in `runs/<T>/gates.yaml`, including who approved and when.

- **Ticket:** [KAN-27: Apply a promo code at checkout](https://foodme-armanayvazyan.atlassian.net/browse/KAN-27) (subtasks KAN-28 backend, KAN-29 checkout UI)
- **Spec doc:** `docs/KAN-27-promo-codes-spec.md`
- **SUT:** https://foodme-armanayvazyan-wox5.onrender.com/

## Setup (once, from the repo root)

```bash
for d in agentic-workflows/functional-testing/skills/*; do ln -sfn "../../$d" .agents/skills/; done   # phase 1
for f in agentic-workflows/functional-testing/agents/*; do ln -sf "../../$f" .agents/agents/; done   # phase 2 (judges)
```

Then start a new `claude` session. MCPs used: Atlassian (Jira), Playwright MCP (browser for step 05; Claude in Chrome is the fallback), Qase.

The status line at the bottom of Claude Code shows the step the run is on, from `runs/<T>/status`, e.g.:

```
STLC KAN-27 │ ✅01 ✅02 ▶03 ⏳04 ⏳05 ⏳06 ⏳07 ⏳08 ⏳10 │ 03 Test cases · case-judge round 1
```

It is set up in `.agents/settings.json` (`statusLine` → `statusline.sh`). A personal `statusLine` in your user settings is replaced while you work in this repo.

- **Phase 1:** only the skills are linked. You review the cases and the tests yourself.
- **Phase 2:** the judges are linked too. Steps 03 and 06 call them, save their verdicts and fix FAILs (up to 2 rounds). You then review with the verdict in front of you.

## Run

One prompt, with only the ticket key, runs the whole flow end to end. The SUT is fixed in the skills.

```
/feature-testing-pipeline KAN-27
```

The agent moves from step to step without stopping. It pauses only for you:

| # | Step | The agent creates | It pauses for you to |
|---|---|---|---|
| 01 | Requirements | `spec.yaml`: ACs, out of scope, gap questions | answer the questions, then approve |
| 02 | Test plan | `plan.md` | approve |
| 03 + 04 | Test cases + case judge | test cases (+ judge verdicts in phase 2) | approve the cases |
| 05 | Execute | `execution.md`: a run plan, then each case run in the browser (Playwright MCP, Chrome as fallback) with a result and a confidence | sign in as a customer in that browser window (only if you aren't); check by hand every case the agent isn't 100% sure about |
| 06 + 07 + 08 | Automate + test judge + run | the Playwright spec (+ verdicts), then `results.json` | approve the tests; the agent then runs them |
| 10 | Report | `report.md`, `found_issues.json` and the HTML report `report.html` (open it in a browser), then the Qase suite, cases and run, then a Jira bug per approved issue | approve the push; pick which issues are real bugs |

Triage (step 09) is skipped for now: mismatches and failures go into the report as "not triaged". Every mismatch also becomes a bug candidate in `found_issues.json`; the agent files a Jira bug (into the active sprint) only for the ones you approve.

If the session stops (you chose to stop, or a step is blocked), run the same prompt again. The agent picks up at the first unfinished step and goes straight back to the open review.

Each step skill can also be run on its own (e.g. `/test-planning KAN-27`) to re-do just that step.
