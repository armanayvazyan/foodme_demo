---
name: jira
description: Work with FoodMe Jira tickets (site yelenatermado.atlassian.net, project SCRUM) through the Atlassian MCP server — pick up a ticket and turn it into a branch + failing test + fix, file a well-formed bug from a failing test, comment test evidence, and move tickets through To Do → In Progress → Done. Use whenever the user mentions a ticket key (SCRUM-123), a planted defect id (FM-BUG-07), "Jira", "ticket", "file a bug", or the branch name contains a ticket key.
---

# Jira workflow (Atlassian MCP)

## Connection

Tools are `mcp__atlassian__*`. If they are missing, the server isn't connected — tell the user to run:

```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
```

then `/mcp` → *atlassian* → Authenticate (OAuth in the browser). Or copy `.mcp.json.example` to
`.mcp.json` (git-ignored). Don't proceed with invented ticket data.

## Constants (verified)

| | |
|---|---|
| cloudId | `yelenatermado.atlassian.net` (or `b35818e9-cb0f-4d6e-b6c0-6153d5fe298c`) |
| Project | `SCRUM` ("My Team AI", team-managed) |
| Issue types | Bug, Story, Task, Subtask, Epic |
| Transitions | `11` → To Do · `21` → In Progress · `31` → Done (global; re-check with `getTransitionsForJiraIssue` if one fails) |
| Labels in use | the planted defect id (`FM-BUG-07`), area (`cart`, `frontend`, `backend`), `bug` |

Planted defects map to tickets by summary prefix/label: search `labels = "FM-BUG-07" OR summary ~ "FM-BUG-07"`.

## A. Pick up a ticket → working fix

1. **Read**: `getJiraIssue` (`responseContentFormat: "markdown"`, include `comment`). Extract:
   expected vs actual behaviour, steps, acceptance criteria. Ambiguous? Ask before coding.
2. **Check status**: if it is already *Done*, verify in the code before doing anything — the
   ticket and the code can disagree (that is a finding: report it).
3. **Branch**: `git checkout -b SCRUM-<n>-<short-kebab>` (from an up-to-date main).
4. **Transition → In Progress** (`21`) — ask the user first unless they told you to work the ticket.
5. **Reproduce with a failing test** at the lowest possible layer (`write-unit-tests` →
   `write-integration-tests` → `write-e2e-tests`). Run it and see it fail for the ticket's reason.
6. **Fix**, rerun that test + the affected suite (`run-regression` with `--only`).
7. **Commit**: `SCRUM-<n>: <summary>`. Push the branch (never main).
8. **Comment** on the ticket (template C) and propose moving to Done — transition only after the user agrees.

## B. File a bug from a failing test

Search first — never duplicate:
`project = SCRUM AND statusCategory != Done AND (text ~ "<keyword>" OR labels = "<FM-id>")`.
Existing issue → add a comment with new evidence instead.

Otherwise `createJiraIssue` (`issueTypeName: "Bug"`, `contentFormat: "markdown"`), **show the draft
to the user first**:

```markdown
**Summary:** <Component>: <what goes wrong> when <condition>      (≤ 90 chars)

## Steps to reproduce
1. …
## Expected
…
## Actual
…
## Evidence
- Failing test: `apps/web/e2e/storefront-flows.spec.ts:63` › "cart quantity decrease keeps item at minimum"
- Error: `expect(locator).toHaveCount(1) — received 0`
- Trace / report: `apps/web/test-results/<dir>/trace.zip`
- Commit: `<git rev-parse --short HEAD>` on `<branch>`
## Suspected cause
`apps/web/src/hooks/useCart.ts:75` — `<= min + 1` should be `<= min` (if known)
```
Labels: area + `bug` (+ the `FM-BUG-NN` id if it is a planted defect).

## C. Comment test evidence

```markdown
**Test evidence — <date>, branch `<branch>` @ `<sha>`**
- Added: `<test file>` › "<test title>" (fails before fix, passes after)
- Regression: backend <p>/<n> · web-unit <p>/<n> · web-e2e <p>/<n> · admin-e2e <p>/<n>   (copy from test-results/regression/summary.md)
- Not run: <anything skipped and why>
```

## Rules

- Read-only calls (get/search/transitions) need no confirmation. **Creating, editing,
  transitioning or commenting is visible to the team: confirm with the user first**
  (`.claude/settings.json` also forces an approval prompt for create/edit/transition).
- Quote numbers and statuses exactly as the tools return them; never claim a test result you didn't run.
- Keep secrets, tokens and `.env` values out of tickets.
