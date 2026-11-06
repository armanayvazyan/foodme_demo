# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- `AGENTS.md`, imported above, is the shared guide for every agent. Put
  project facts there, and keep only Claude-specific notes in this file.
- Project skills live in `.agents/skills/` so other agents can use them too.
  `.claude/skills/` links to them, so Claude Code loads the same files.
- Put personal Claude Code settings in `.claude/settings.local.json`, which
  git ignores.
- For Jira, use the Atlassian connector with site
  `naramnacakanyan77.atlassian.net` and project `KAN`.
- To check the live site, use a browser against
  https://foodme-nairamnatsakanyan.onrender.com rather than relying on the code alone.
