# AGENTS.md — FoodMe

Instructions for any AI coding agent (Claude Code, Codex, Cursor, Copilot, …) working in this repo.
Claude-specific setup lives in `CLAUDE.md`; shared skills and rules are in `.agents/`.

## What this is

FoodMe is a food-ordering app used as a **QA / test-automation training project**. It contains
intentional defects marked `// FM-BUG-NN` and flaky tests marked `// FM-FLAKE-NN`.
**Do not fix or remove them unless the task is that defect** (see `.agents/rules/planted-defects.md`).

| Path | Stack | Port |
|---|---|---|
| `apps/backend` | Spring Boot 3.3 · Java 17 · Gradle · JPA · Flyway · Postgres (H2 in tests) · JWT | 8081 |
| `apps/web` | Storefront · React 19 · Vite 8 · TypeScript · Tailwind 4 · TanStack Query · Dexie | 5180 (E2E) |
| `apps/admin` | Back-office · react-admin 5 · React 18 · MUI · JS | 5174 |
| `infra/monitoring` | Prometheus + Loki + Grafana + Grafana MCP (Render) | — |

In production the backend serves the web SPA at `/` and admin at `/backoffice` (`apps/backend/Dockerfile`).

## Commands

```bash
# backend (JDK 17 required)
cd apps/backend && ./gradlew test                       # unit + integration (H2), ~1 min
cd apps/backend && ./gradlew test --tests '*OrderServiceTest'
cd apps/backend && ./gradlew bootRun                    # needs Postgres foodme/foodme on :5432

# web
cd apps/web && npm ci
npm run test:unit            # Vitest, src/**/*.test.ts
npm run test:e2e             # Playwright, e2e/*.spec.ts (backend must be up)
npx tsc -b && npm run lint   # typecheck + oxlint

# admin
cd apps/admin && npm ci && npm run lint && npm run test:e2e

# everything, with a triaged summary in test-results/regression/summary.md
./scripts/regression.sh            # or --skip-e2e, --only web-unit, --grep checkout
```

## Testing pyramid

| Layer | Tool | Location | Use for |
|---|---|---|---|
| Unit | Vitest | `apps/web/src/**/<name>.test.ts` (colocated) | cart, schemas, utils, hooks |
| Unit | JUnit 5 + Mockito + AssertJ | `apps/backend/src/test/java/.../service/*Test.java` | service logic |
| Integration | `@SpringBootTest` + MockMvc + H2 | `apps/backend/src/test/java/am/foodme/backend/*ControllerTest.java` | endpoints, security, JPA |
| E2E | Playwright | `apps/{web,admin}/e2e/*.spec.ts` | user journeys |

Push tests to the lowest layer that can catch the bug. Every bug fix ships with a test that
failed before the fix. Test rules: `.agents/rules/testing.md` (no sleeps, no `.only`, no
assertion-free tests, skips need a Jira key).

## Conventions

- Branch `SCRUM-<n>-<kebab>`; commit `SCRUM-<n>: <imperative summary>`. Never push to `main`.
- DB changes = new Flyway migration `V<next>__<desc>.sql`; never edit applied ones.
- Never read or commit `.env*` (except `.env.example`), `.mcp.json`, lockfile hand-edits.
- Web: logic in `src/lib|hooks|schemas`, `@/` imports, strings via i18n. Backend: constructor
  injection, `NotFoundException`/`BadRequestException` for 404/400.

## Jira

Project `SCRUM` on `yelenatermado.atlassian.net`, via the Atlassian MCP server
(`https://mcp.atlassian.com/v1/mcp`). Workflow and templates: `.agents/skills/jira/SKILL.md`.

## Skills (`.agents/skills/`)

`write-unit-tests` · `write-integration-tests` · `write-e2e-tests` · `run-regression` · `jira`
