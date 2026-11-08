# CLAUDE.md

@AGENTS.md

## Claude Code specifics

Everything below is loaded in addition to `AGENTS.md` above.

- **Rules** in `.claude/rules/` load automatically; the app-specific ones (`backend-java`,
  `web-frontend`, `admin`, `database-migrations`, `testing`) only when you touch matching paths.
- **Skills** in `.claude/skills/` — invoke the matching one before starting:
  writing tests → `write-unit-tests` / `write-integration-tests` / `write-e2e-tests`;
  "run all tests" → `run-regression`; any `SCRUM-<n>` key or "file a bug" → `jira`.
- **Subagent** `test-runner` runs suites and returns a ≤25-line triaged result. Prefer it over
  running long suites in the main context.
- **Jira** comes from the Atlassian MCP server (`mcp__atlassian__*`). Not connected?
  `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp`, then `/mcp` to log in.

## Hooks (`.claude/settings.json`) — what will stop you

| Hook | When | Effect |
|---|---|---|
| `guard-bash` | before Bash | **denies** push to main/master, `--force`, `--no-verify`, `rm -rf` of /, ~, ., globs or outside the repo, `curl \| sh`, `chmod 777`, reading `.env`; **asks** for `reset --hard`, `clean -f`, `--force-with-lease`, destructive SQL, Docker volume removal |
| `guard-files` | before Edit/Write | denies `.env*`, lockfiles, applied Flyway migrations; asks before removing an `FM-BUG`/`FM-FLAKE` marker |
| `test-quality` | before Edit/Write of a test | denies *newly added* `.only`, sleeps, assertion-free tests, tautologies, empty catches, untracked skips |
| `format` | after Edit/Write | Prettier (printWidth 100) — new files always, edited files only if they were already clean |
| `session-context` | session start | briefing: branch → Jira key, dirty files, which services are up |
| `quality-gate` | when you finish | tsc/oxlint/`vitest related` (web), eslint (admin), compile + changed test classes (backend); asks once for tests if prod code changed without any |
| `log-actions` | every event | redacted audit trail in `.claude/logs/actions.jsonl` |

A denied call explains why and what to do instead: follow it, don't route around it.
Hook tests: `node --test .claude/hooks/__tests__/*.test.mjs`. Disable the Stop gate for one
session with `FOODME_QUALITY_GATE=off`. Personal overrides go in `.claude/settings.local.json`.

## Before you say "done"

1. Run the tests for what you changed (the Stop hook will check anyway).
2. Report honestly: what ran, what passed, what was skipped, and any planted defect you noticed.
