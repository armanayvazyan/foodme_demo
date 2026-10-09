# Triage: subagent-driven root-cause analysis with a human in the loop

You name a problem. A brain plans the investigation, workers collect evidence, a judge checks the analysis, and you review and decide, in chat.

You never create or edit a file. The agent records your decisions in `runs/<id>/gates.yaml`, including who approved and when.

| Role | Runs as | Model | Tools | Job |
|---|---|---|---|---|
| **Brain** | main session, skill `triage-pipeline` | opus | all, incl. **Jira** | intake, briefs, hypotheses, rating, your reviews, Jira + Grafana write-back |
| **`triage-worker`** | subagent | sonnet | Playwright MCP, Grafana (Loki, Prometheus), GlitchTip. **No Jira** | one investigation brief at a time; raw output to `runs/<id>/raw/`, a short JSON back |
| **`triage-judge`** | subagent (phase 2) | opus | Read, Grep, Glob | checks `triage.md` against the raw evidence (J1–J7) |

- **SUT:** https://foodme-armanayvazyan-wox5.onrender.com/ (prod)
- **Black-box:** nobody reads the app's source. The root cause names a component and a behaviour, never a code line.
- **Own root cause first:** existing Jira bugs are looked at only after you approve the root cause (duplicate search and linking).

## Setup (once, from the repo root)

```bash
ln -sfn agentic-workflows/triage/skills/triage-pipeline .agents/skills/                                   # phase 1
ln -sf  agentic-workflows/triage/agents/triage-worker.md .agents/agents/                                    # phase 1
ln -sf  agentic-workflows/triage/agents/triage-judge.md .agents/agents/                                     # phase 2 (judge)
```

Then start a new `claude` session on **opus** (`/model opus`). MCPs used: Atlassian (Jira), Playwright MCP, Grafana, GlitchTip (all in `.agents/mcp.json`).

- **Phase 1:** brain + worker. You review the root cause yourself.
- **Phase 2:** the judge is linked too. The brain has it check `triage.md`, fixes FAILs (up to 2 rounds), and shows you the verdict in the review.

## Run

One prompt, with the problem in any form:

```
/triage-pipeline KAN-33
/triage-pipeline <GlitchTip issue id or URL>
/triage-pipeline SAVE10 gives a far too large discount after another code was tried
```

| # | Step | Who | Creates | Pauses for you to |
|---|---|---|---|---|
| T1 | Intake | brain | `problem.yaml` | confirm the problem statement |
| T2 | First look | workers in parallel: reproduce (browser) · history (Loki) · errors (GlitchTip) | `raw/B-01…` | sign in as a customer in the Playwright window (only if it isn't) |
| T3 | Targeted evidence | workers in parallel: logs, metrics and errors for the repro windows | `raw/B-…` | — |
| T4 | Hypotheses | brain plans discriminating checks; workers run them (max 2 rounds) | `triage.md` | — |
| T5 | Judge (phase 2) | `triage-judge` | `verdicts/T5-NN.json` | — |
| T6 | Review + write-back | brain | **Write-back** in `triage.md`, Jira comment/bug, duplicate links, Grafana annotations | approve the root cause; pick the write-back actions |

### What you get

`runs/<id>/triage.md` and the final reply show **every root-cause candidate, rated**, each with all its artifacts:

| Rating | Means |
|---|---|
| Confirmed | explains everything, nothing contradicts it, a discriminating check came out as it predicted, two kinds of artifact agree |
| Likely | explains everything, nothing contradicts it, not yet proven by a discriminating check |
| Possible | explains part, untested |
| Unlikely | explains little, or needs an unsupported assumption |
| Ruled out | an artifact contradicts it |

Artifacts are repro steps, network request/response bodies, screenshots, console lines, Loki lines (with Grafana Explore links), Prometheus queries and GlitchTip events (with links). Each is quoted word for word from `raw/<brief>.md`.

### Run directory `runs/<id>/`

`<id>` = the Jira key, or `TRI-<yyyymmdd>-<slug>` for GlitchTip or free-text input.

```
problem.yaml   briefs.md   raw/B-NN.md   triage.md   verdicts/T5-NN.json   gates.yaml
```

If the session stops, run the same prompt again. The brain picks up at the first unfinished step.
