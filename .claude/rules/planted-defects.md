# Planted defects (training repo)

This repo is a QA training project. Comments like `// FM-BUG-07` or `// FM-FLAKE-01` mark
**intentional** defects that students find, report and fix.

- Do not fix, "clean up" or delete code next to an `FM-BUG-NN` / `FM-FLAKE-NN` marker unless the
  task is explicitly that defect (its Jira ticket, or the user names it). `guard-files.mjs` asks for
  confirmation before any edit removes a marker.
- If you notice one while doing other work, mention it in your summary instead of changing it.
- When you do fix one: write the failing test first, fix, keep the marker out of the final code,
  and reference the Jira key in the commit message.
- `instructor/` and `docs/planted-defects.md` are git-ignored on purpose. Never create or commit them.
