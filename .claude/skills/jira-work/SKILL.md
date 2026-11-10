---
name: jira-work
description: Work with Jira tickets - read a ticket and its acceptance
  criteria, draft a bug report, add test results as a comment. Use when
  the user mentions a ticket key like SCRUM-5 or asks to create or update
  a Jira issue.
---
1. Read the ticket with the Jira tools. Extract: summary, issue type, numbered AC, and "Not in this release".
2. Never invent AC. If AC is missing, ask the user.
   Exception: a Bug ticket usually has Steps / Expected / Actual and no AC.
   For a Bug, treat the "Expected Result" as the AC (AC: 1), and say so
   in the answer. If there is no Expected Result either, ask the user.
3. Bug report title: "[Area] what broke".
   Body: Steps, Expected (cite the AC), Actual, Severity, Evidence.
4. BEFORE creating or changing any issue: show the draft and ask "Create it?". Wait for a clear yes.
5. Test results comment: a table "Test ID | AC | Result".
6. Never change status or assignee unless the user asks.
