---
name: jira-bug
description: Create, search or update Jira bugs in project SCRUM. Use when the user asks to report, log, find or update a bug or Jira ticket.
---

# Working with Jira bugs (project SCRUM)

Use the Atlassian connector. Site: tatevpetrossian.atlassian.net, project key: SCRUM.

## Creating a bug
1. Search first for duplicates (JQL: project = SCRUM AND type = Bug AND text ~ "<keywords>"). If a similar bug exists, show it and ask before creating a new one.
2. If possible, reproduce the bug and check at least one other case (another item/page) to know if it is general.
3. Show the draft to the user and create it only after they confirm.
4. Work type: Bug. Priority: Medium unless the user says otherwise. Title: short, no "[Bug]" prefix, describes the problem, not one specific item.
5. Description format:
   - **Environment:** URL, browser
   - **Scope:** which items/pages are affected
   - **Steps to reproduce:** numbered
   - **Expected result**
   - **Actual result**
   - **Severity:** with a short reason and workaround
   - **Notes:** related commit or patch, if known
6. Reply with the ticket key and link.

## Searching and updating
- To list bugs, use JQL and show key, title, status and priority in a short table.
- Before changing status, title or type, say what will change and ask for confirmation.
