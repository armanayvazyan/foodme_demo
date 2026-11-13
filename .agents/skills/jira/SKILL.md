---
name: jira
description: Use when creating, updating, triaging or reading Jira tickets for FoodMe (project KAN on foodme-armanayvazyan.atlassian.net), including filing a bug found during QA, writing a task or subtask, or re-prioritising an existing bug.
---

# Working with Jira (FoodMe)

## Site facts

| | |
|---|---|
| Site | `https://foodme-armanayvazyan.atlassian.net` |
| cloudId | `d1b349bd-e735-4fc6-b2c5-9e95f558b8be` |
| Project | `KAN` (team-managed). Board id `2` ("KAN board"). Ignore `SAM1`, which is Atlassian sample data. |
| Issue types | `Feature` (id 10008), `Task` (10009), `Subtask` (10007), `Epic` (10006). **There is no `Bug` type.** |
| Priorities | `Highest`, `High`, `Medium`, `Low`, `Lowest` |

Use the Atlassian MCP tools: `createJiraIssue`, `editJiraIssue`, `getJiraIssue`, `searchJiraIssuesUsingJql`, `transitionJiraIssue`. For anything else, call `discover` first.

## Ticket shapes

| Kind | Issue type | Summary | Labels | Template |
|---|---|---|---|---|
| Bug | `Task` | `Bug: <what the user sees go wrong>` | `bug`, `agent-ready`, and area labels | `templates/bug-report.md` |
| Task (a slice of a feature) | `Subtask` with `parent` = the Feature | outcome in plain words, no prefix | `agent-ready`, and area labels | `templates/task.md` |
| Feature | `Feature` | user-facing outcome | `agent-ready`, `foodme`, and area labels | see KAN-5 |

Area labels in use: `web`, `admin`, `backend`, `cart`, `checkout`, `security`. Reuse these before inventing new ones.

Write descriptions in Markdown, for a non-technical reader: say what the customer sees, not class names. Put technical detail (endpoints, DevTools steps) only where it is needed to reproduce the problem.

## Rule: every new ticket goes into the current sprint

When you create any ticket, pass `assignToSprint: "active"` to `createJiraIssue`. For an existing ticket, move it with `transitionJiraIssue` (sprint move).

If the sprint assignment fails (no active sprint, or "The board does not support sprints"), the ticket is still created. **Report the failure to the user** and name the ticket that isn't in a sprint. Don't create a sprint, turn sprints on, or pick a future sprint unless the user asks for it.

## Rule: for bugs, set priority from your own review

Don't copy the reporter's priority, and don't leave the `Medium` default. Before you create or update a bug, review it: reproduce it or read the code, then check how many users it hits and what it costs them. Pick the priority from this table:

| Priority | When | Examples in KAN |
|---|---|---|
| **Highest** | Money is wrong, data gets corrupted, or a security/validation hole can be exploited. No workaround. | KAN-23 (negative quantities accepted), KAN-20 (saved total ≠ checkout total) |
| **High** | A core flow (browse → basket → checkout → order) is broken or blocks revenue for some users. A workaround exists but is not obvious. | KAN-24 (disabled or other-chef dishes can be ordered), KAN-21 (active chef missing from Explore), KAN-19 (basket "−" removes the dish) |
| **Medium** | Wrong behaviour at an edge or boundary, or wrong display with little cost. | KAN-22 (delivery charged at exactly the threshold), KAN-25 (order times in the wrong time zone) |
| **Low** | Cosmetic, copy or layout problems, where nothing is lost. | |
| **Lowest** | Nice-to-have polish. | |

Move up one level if the bug hits every user or has no workaround. Move down one level if it needs tampering or a rare setup and causes no harm.

When you change the priority of an existing bug, add a comment with the old and new priority and a one-line reason. On a new bug, put the reason in the create response to the user.

## Workflow

1. Search for duplicates first: `project = KAN AND summary ~ "<keywords>" ORDER BY created DESC`. If you find one, update it or comment on it instead of creating a new ticket.
2. Fill in the matching template from `templates/`. Keep every heading. Write "None" rather than dropping a section.
3. For bugs, set the priority using the table above.
4. Call `createJiraIssue` with `projectKey: "KAN"`, the issue type, summary, description, `priority`, `labels` and `assignToSprint: "active"`. For a Subtask, add the `parent` key.
5. Tell the user the ticket key and link, the priority and its reason, and whether the sprint assignment worked.

## Things to leave alone

- Don't list the intentional demo behaviour from `CLAUDE.md` as bugs: simulated latency, the flaky heartbeat, `/api/debug/boom` and body logging.
- `FM-BUG-nn` references in tickets point to seeded course defects. Keep them as they are.
- Don't close, delete or transition tickets the user didn't mention.
