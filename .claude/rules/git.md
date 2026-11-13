# Git

Loaded every session; there are no path filters on purpose.

## Branches

- **Keep the branch list small.** `main` is the workshop baseline, and course exercises depend on a few named branches:
  - `feature/KAN-4-order-ratings`: PR-review exercise, with deliberate defects
  - `feature/KAN-27-promo-codes`, `test/KAN-27-promo-codes`: Session 6 promo / functional-testing pipeline
  - `session_6`, `cohort_1`: snapshots used in class
- **Ask before creating a branch.** Put work on the ticket branch it belongs to. Don't create new branches without asking, even for small fixes. If a change must reach `main` on its own, ask how to land it.
- **Don't rewrite exercise branches.** Never rebase, force-push, reset or delete the branches above. Students and the instructor scripts point at their commits.
- **`main` is protected.** Changes land through a PR and get squash-merged, which appends ` (#N)` to the subject. Never push directly to `main`, and never force-push it.

## Commits

- **Conventional Commits with a scope.** The subject is `type(scope): summary`, imperative and lowercase, with no trailing period. Common types are `feat`, `fix`, `docs`, `test`, `perf`, `chore`, `revert`. Scopes match areas: `backend`, `web`, `admin`, `db`, `checkout`, `readme`, `mcp`, `ci`. Add the ticket key when there is one, e.g. `feat(checkout): apply a promo code at checkout (KAN-27)`.
- **Body explains why.** Keep it short, and use bullets when there are several changes.
- **One concern per commit.** Keep backend, frontend and migration changes in separate commits when they can stand alone.
- **Commit or push only when asked.**

## Never commit

- **Instructor material.** `docs/`, `instructor/`, `docs/planted-defects.md`. These are gitignored. Never `git add -f` them.
- **Secrets and local config.** `.env`, `.env.*` (except `.env.example`), `.mcp.json`, `infra/docker-compose.local.yml`.
- **Build output.** `build/`, `dist/`, `node_modules/`, `test-results/`, `playwright-report/`.
- **Planted defects and their tests.** Don't change `FM-BUG-nn` lines or the tests asserting them as a side effect of other work. Don't add commit messages, PR text or comments that reveal unmarked defects either. Students' agents read the git history and PRs.

## Pull requests

- **Base and title.** Target `main` unless told otherwise. Use the commit-subject format for the title.
- **Description.** Say what changed, why, and how it was verified: which commands ran (`./gradlew test`, `npm run build`, `npm run lint`, `npm run test:e2e`) and their result.
- **Deploys.** Render auto-deploys `main` on merge (`render.yaml`, `autoDeploy: true`). Students fork `main`, so keep it deployable.
