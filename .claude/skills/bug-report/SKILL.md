---
name: bug-report
description: Turn a suspected FoodMe defect into a minimal, reproducible bug report with evidence (API calls, screenshots, logs). Use when the user says "I found a bug", "write a bug report", "file this defect", or after a failing test case.
---

# Bug report

## 1. Reproduce before writing

- Reproduce at the **lowest layer** that shows the bug. If the API already
  returns the wrong value, reproduce with `curl` (see the `api-smoke` skill),
  not through the UI.
- Find the minimal input: one dish, one quantity, one step fewer until it
  stops failing.
- Record the actual vs expected value. Expected must come from a written
  rule (`AGENTS.md` → Domain rules, UI copy, API contract), not opinion.
- If you can't reproduce it, say so and stop — don't write a speculative report.

## 2. Locate (optional, only if asked or obvious)

Point to the file:line most likely responsible. Do **not** change code.
If the code carries an `FM-BUG-NN` marker, mention the ID in the report.

## 3. Report template

```markdown
**Title:** <component>: <wrong behaviour> when <condition>

**Severity:** Critical | Major | Minor | Trivial   **Priority:** P1–P3
**Environment:** local / Render URL, browser, commit `git rev-parse --short HEAD`

**Preconditions:**
**Steps to reproduce:**
1. ...
**Expected:** ...  (source of the rule)
**Actual:** ...
**Evidence:** curl command + response, screenshot path, GlitchTip / Loki link
**Suspected cause:** file:line (optional)
**Regression test idea:** which test case / spec would catch it
```

Severity guide: wrong money or lost order = Critical; security (XSS, data of
another user) = Critical; wrong list/pagination = Major; cosmetic = Minor.

Write the report to the conversation, or to `docs/bugs/<short-slug>.md` if
the user wants a file. Never add it to `docs/planted-defects.md`.
