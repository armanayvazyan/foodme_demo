# Git and GitHub conventions

`main` is protected. Nobody pushes to it directly, admins included. Every change reaches `main` through a pull request.

## Branches

- Branch off an up-to-date `main`. One branch per Jira ticket.
- Name: `<type>/KAN-<n>-<short-slug>`, e.g. `feature/KAN-4-order-ratings`, `fix/KAN-19-cart-decrement`.
- Types: `feature`, `fix`, `chore`, `docs`, `test`, `ci`.
- `introduce-bug-*` and `instructor` branches are course material. Leave them alone.

## Commits

- Conventional Commits: `<type>(<scope>): <summary> (KAN-<n>)`.
  - type: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`, `ci`.
  - scope: the area, e.g. `backend`, `web`, `admin`, `cart`, `ci`, `rules`.
  - summary: imperative, lower case, no trailing period, about 72 characters max.
- Commit only the files that belong to the change. Never commit `.env*` (other than `.env.example`), `.agentsecrets/` or `.agents/settings.local.json`.
- Don't rewrite history that is already pushed to a shared branch. Never force-push `main`.

## Pull requests

- Push the branch and open a PR into `main` only when the user asks for one.
- Title: same format as a commit summary. Body: what changed, the Jira link, and how it was tested.
- Merge rules (enforced by branch protection on `main`):
  - Required status checks must pass: `Backend Build`, `Web Build`, `Admin Build`, `Docker Build`.
  - The branch must be up to date with `main` before merging.
  - All review conversations must be resolved.
- `Claude PR Review` posts an automated review on every PR. It needs the `CLAUDE_CODE_OAUTH_TOKEN` repo secret (generate it with `claude setup-token`). Treat its findings like a human reviewer's: fix them or reply with a reason.
- Prefer squash merge. Delete the branch after merging.

## Before you push

Run the checks for every app you touched (see the commands in `CLAUDE.md`): `./gradlew build` for the backend, and `npm run lint` plus `npm run build` for web and admin.
