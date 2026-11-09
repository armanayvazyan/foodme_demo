# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- `AGENTS.md`, imported above, is the shared guide for every agent. Put
  project facts there, and keep only Claude-specific notes in this file.
- Project skills live in `.agents/skills/` so other agents can use them too.
  `.claude/skills/` links to them, so Claude Code loads the same files.
- After a regression run, the `report-regression` hook adds the summary to
  your context. Report it in full as the `run-regression` skill describes;
  don't just repeat the one-line result.
- Put personal Claude Code settings in `.claude/settings.local.json`, which
  git ignores.
- For Jira, use the `work-with-jira` skill and the Atlassian MCP server
  (copy `.mcp.json.example` to `.mcp.json`, then sign in from `/mcp`).
- To check the live site, use a browser against
  https://foodme-nairamnatsakanyan.onrender.com rather than relying on the code alone.
