<!--
Task template. Modelled on KAN-13 (a Subtask of Feature KAN-5).
Issue type: Subtask with parent = the Feature key. A standalone Task has no parent: drop "Depends on" if nothing blocks it.
Summary: the outcome in plain words, no prefix.
Labels: agent-ready, plus area labels (web, admin, backend, ...). Priority: Medium unless the user says otherwise.
Sprint: assignToSprint "active".
Delete this comment before submitting.
-->
## Depends on

<The tickets that must land first, by summary and key. Write "None" if nothing blocks it.>

## User story

As a <customer / admin / chef>, I can <do something> so that <benefit>.

## Experience

* <What the user sees and does, screen by screen. Put UI labels in **bold**. Quote exact copy, e.g. "Cancel order FM-xxxxxx? This can't be undone.">
* <States and edge cases: empty, error, race conditions, mobile vs desktop.>
* <What must not change.>

## Not in scope

* <What this task deliberately leaves out. Write "None" if nothing.>

## Done when

* An automated test covers: <the end-to-end scenario>.
* Works on mobile and desktop. <Delete this line for backend-only work.>
* All automated checks pass.
