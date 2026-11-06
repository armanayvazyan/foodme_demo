---
name: jira
description: Work with the FoodMe Jira project (SCRUM on tatevpetrossian.atlassian.net) through the Atlassian MCP — file bug reports, pick up a ticket and take it through branch → fix → PR, post retest results, transition status, and search/summarize issues. Use whenever the user mentions Jira, a ticket or issue key like SCRUM-12, filing/logging/reporting a bug, retesting, or "what's on the board".
---

# Working with Jira (SCRUM project)

## Connection facts (don't re-discover)

- Site: `https://tatevpetrossian.atlassian.net`
- cloudId: `09caeda2-8ffe-4a69-a4f8-6cf2dc25954e`
- Project key: `SCRUM` ("AI project"). It's a team-managed Scrum project with one active sprint at a time.
- Issue types seen: `Bug`, `Subtask` (plus the default `Task` / `Story` / `Epic`). Statuses: `To Do` → `In Progress` → `Done`.
- Tools: `mcp__claude_ai_Atlassian_MCP__*`: `getJiraIssue`, `searchJiraIssuesUsingJql`, `createJiraIssue`, `editJiraIssue`, `addOrEditJiraIssueComment`, `transitionJiraIssue`. For anything else, call `discover` with a description of the goal.
- Load a tool's schema with `ToolSearch` (`select:<name>`) before the first call if it isn't loaded yet.
- Never hardcode transition ids. Look up the available transitions for the issue first, then pick the one by name.

## Ground rules

- **Reading is free. Every write needs confirmation.** That covers creating issues, comments, edits, transitions and assignments. Show the user the exact content (summary, description, labels, target status) and wait for a yes before calling the tool. Jira is shared and notifies watchers.
- Write in Markdown. The MCP converts it.
- Always link to issues as `https://tatevpetrossian.atlassian.net/browse/SCRUM-N`.
- This repo is a QA course with **planted bugs** (`// FM-BUG-NN` in code). Tickets for them get the label `FM-BUG-NN`. Fix a planted bug only when a ticket asks for it.

## Workflow 1: File a bug

1. **Reproduce first.** Use the deployed app (`https://foodme-tatevikpetrosyan.onrender.com`) or local dev, through a browser skill or the API. Note the exact steps, data and URLs. If you can't reproduce the bug, say so instead of filing it.
2. **Check for duplicates:**
   `project = SCRUM AND type = Bug AND statusCategory != Done AND text ~ "<keyword>"`
3. **Find the cause, if you can.** Search the code and `git log` for the area. If it maps to an `FM-BUG-NN` marker, mention it in Notes and add the label.
4. Draft the issue in this format (it matches SCRUM-5), show it to the user, then call `createJiraIssue` with `issueTypeName: "Bug"`:

```markdown
**Environment:** <URL> (<browser / device>)

**Scope:** <what is affected: one item or all, which pages>

**Steps to reproduce:**

1. ...
2. ...

**Expected result:** ...

**Actual result:** ...

**Severity:** <Low/Medium/High/Critical> — <user impact>; workaround: <if any>

**Notes:**

* <observations, boundaries where it works or fails>
* <suspected cause / related commit or FM-BUG-NN>
```

- **Summary:** `<Area>: <what goes wrong>`, for example `Cart: decreasing any item's quantity from 2 removes the item instead of setting it to 1`
- **Labels:** `bug`, the area (`cart`, `checkout`, `chef`, `orders`, `auth`, `admin`, `backend`…), and `FM-BUG-NN` if known
- **Priority:** derive it from severity (default `Medium`)
- Ask whether to add the bug to the active sprint and assign it to the user.

## Workflow 2: Work a ticket (SCRUM-N)

1. `getJiraIssue`: read the description and comments, and restate the expected behavior.
2. Offer to transition the ticket to **In Progress** and assign it to the user (confirm first).
3. Branch from up-to-date `main`: `fix/SCRUM-N-<short-slug>` (or `feat/…` for features).
4. Reproduce, then fix. Add a regression test for the exact failing case with the `write-unit-tests`, `write-integration-tests` or `write-e2e-tests` skill. If the test asserted the buggy behavior, update it. Remove the `// FM-BUG-NN` marker if the fix eliminates it.
5. Commit: `fix(<scope>): <description> (SCRUM-N)`. Explain the root cause in the commit body.
6. When the user asks, push and open a PR whose title is the commit subject and whose body links the ticket.
7. Comment on the ticket (confirm first): root cause, the fix, the tests added, and the PR link.
8. **Leave the ticket open.** It moves to Done only after a retest on the deployed app (Workflow 3).

## Workflow 3: Retest / verify a fix

1. Retest on the deployed environment (after the fix is merged and deployed), following the ticket's original steps plus edge cases around them.
2. Post a comment in this format (it matches the SCRUM-5 retest):

```markdown
**Retest — YYYY-MM-DD — PASSED|FAILED**

Environment: <URL>, <browser>. Tested on <pages/data>.

| # | Check | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| 1 | <original failing step> | ... | ... | ✅ Pass / ❌ Fail |
| 2 | <edge case / regression check> | ... | ... | ✅ Pass |

Not covered: <browsers, devices, scenarios not tested>
```

3. If it **passed**, offer to transition the ticket to **Done**. If it **failed**, keep it open (or move it back to In Progress), and spell out in the comment exactly which check failed.

## Workflow 4: Search and summarize

Useful JQL:
- My open work: `project = SCRUM AND assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC`
- Active sprint board: `project = SCRUM AND sprint in openSprints() ORDER BY status, rank`
- Open bugs: `project = SCRUM AND type = Bug AND statusCategory != Done`
- Planted-bug tickets: `project = SCRUM AND labels in (FM-BUG-01, FM-BUG-02, FM-BUG-03, FM-BUG-04, FM-BUG-05, FM-BUG-06, FM-BUG-07, FM-BUG-08)`
- Recently changed: `project = SCRUM AND updated >= -7d ORDER BY updated DESC`

Summarize as a short table (key + link, summary, status, assignee). Don't dump raw JSON.
