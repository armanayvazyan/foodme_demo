# Git workflow

- Never commit or push to `main`/`master` (blocked by `guard-bash.mjs`). Branch first:
  `SCRUM-<n>-<short-kebab>` when there is a Jira ticket, otherwise `<type>/<short-kebab>`.
- Commit messages: `SCRUM-<n>: <imperative summary>` (≤ 72 chars), body says *why*.
- No `--no-verify`, no `--force` (use `--force-with-lease` on your own branch, it asks first).
- Never commit `.env`, `.mcp.json`, `.claude/settings.local.json`, `.claude/logs/`, `test-results/`,
  `playwright-report/`, `build/`, `dist/`.
- Lockfiles change only via `npm install` / `npm uninstall` in that app.
