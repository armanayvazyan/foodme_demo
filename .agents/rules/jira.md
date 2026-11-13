# Jira

Before you create, edit or triage any Jira ticket, load the `jira` skill. This applies even when another skill (e.g. `atlassian:triage-issue`) is doing the work.

- Every new ticket goes into the current sprint: `assignToSprint: "active"`. If that fails, tell the user. Don't skip it silently.
- For bugs, set the priority from your own review, using the rubric in the skill. Don't use the reporter's priority or the default.
