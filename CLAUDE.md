# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Path-scoped rules in `.claude/rules/` load automatically when you work on
  matching files (backend, web, admin, e2e). Follow them.
- Project skills live in `.claude/skills/`. Use them when the task fits:
  - `generate-test-cases` — write structured manual/automatable test cases for a feature.
  - `bug-report` — turn a found defect into a reproducible report.
  - `flaky-test-triage` — diagnose and stabilise a flaky Playwright/JUnit test.
  - `api-smoke` — curl-based smoke check of a running backend.
  - `flyway-migration` — add a schema/seed change safely.
- Prefer delegating broad codebase searches to an Explore subagent.
- When asked to "fix lint", run the real linter for that app first
  (`oxlint` for web, `eslint` for admin) — don't guess from reading code.
- Never "helpfully" fix an `FM-BUG-*` or `FM-FLAKE-*` while working on
  something else; mention it to the user instead.
