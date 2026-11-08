# .agents — tool-neutral agent assets

The single source of truth lives in `.claude/` (where Claude Code loads it); this folder exposes
the same files under the vendor-neutral `.agents/` convention used by other agents
(e.g. Codex reads `.agents/skills/`). Edit the files once — the links follow.

| Path | → | Contents |
|---|---|---|
| `skills/` | `.claude/skills/` | `SKILL.md` playbooks: write-unit-tests, write-integration-tests, write-e2e-tests, run-regression, jira |
| `rules/` | `.claude/rules/` | project rules; `paths:` front-matter scopes a rule to matching files |
| `agents/` | `.claude/agents/` | subagent definitions (test-runner) |

Entry point for every agent: `/AGENTS.md`. On Windows, clone with `git config core.symlinks true`
(or Developer Mode) so the links resolve.
