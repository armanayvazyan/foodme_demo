# General rules

- This is a monorepo: `apps/web` (customer site), `apps/admin` (admin panel), `apps/backend` (Java/Gradle API).
- Make small, focused changes. Don't refactor code unrelated to the task.
- Never commit or push directly to `main`. Work on a feature branch.
- Never commit secrets. Use `.env.example` for new environment variables.
- When a bug has an ID in a comment (like `// FM-BUG-07`), mention that ID in the commit message.
