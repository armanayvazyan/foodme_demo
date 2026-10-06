# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FoodMe is a small food-ordering app (chef list → chef menu → cart → cash-only checkout) plus a back-office admin. It is used as a training / QA workshop system, deployed to Render's free tier as a one-click blueprint (`render.yaml`, `render-monitoring.yaml`). The root `README.md` is a non-technical, student-facing deploy guide.

Three apps in `apps/`, each with its own build (no workspace tooling at the root):

- `apps/backend`: Spring Boot 3.3 / Java 17 / Gradle, Postgres + Flyway, JWT auth.
- `apps/web`: customer storefront. React 19 + TypeScript + Vite + Tailwind 4 + shadcn-style UI (`components/ui`), TanStack Query, react-hook-form + zod, i18next, Dexie (IndexedDB).
- `apps/admin`: back office. React 18 + react-admin 5 + MUI, plain JS/JSX.
- `infra/monitoring/stack`: a single container running Prometheus + Loki + Grafana + Grafana MCP behind nginx under supervisord. See `infra/monitoring/README.md`.

## Commands

Backend (run from `apps/backend`):

```bash
./gradlew build                                  # compile + tests (what CI runs)
./gradlew test                                   # all tests
./gradlew test --tests OrderControllerTest       # one class
./gradlew test --tests 'OrderControllerTest.someMethod'   # one method
./gradlew bootRun                                # serves on :8081
```

`bootRun` needs Postgres on `localhost:5432` with db, user and password all `foodme` (override with `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`, `SPRING_DATASOURCE_URL`, or a `postgresql://` `DATABASE_URL`). Flyway creates the `foodme` schema. Swagger UI is at `/swagger-ui.html`.

Web (run from `apps/web`) and admin (run from `apps/admin`):

```bash
npm ci
npm run dev          # Vite dev server; in dev mode the API base defaults to http://localhost:8081
npm run lint         # web: oxlint, admin: eslint
npm run build        # web: tsc -b && vite build, admin: vite build
npm run test:e2e     # Playwright (starts its own dev server: web on :5180, admin on :5174)
npx playwright test e2e/happy-path.spec.ts          # one spec
npx playwright test -g "test title"                 # one test by name
```

The e2e suites hit a real backend, so start the backend first. `apps/web` also has `npm run test:e2e:all`, which runs the web suite and then the admin suite. Override targets with `PLAYWRIGHT_BASE_URL` (web) or `ADMIN_BASE_URL` (admin).

Full production image (build context is the repo root): `docker build -f apps/backend/Dockerfile .`

## Architecture

Architecture and conventions live in path-scoped rules under `.agents/rules/` (`.claude/rules/` is a symlink). The app rules load when you work in that app.

| Rule | Loads for | Covers |
|---|---|---|
| `architecture.md` | always | repo hierarchy, how the apps connect, one-origin serving |
| `backend-architecture.md` | `apps/backend/**` | package hierarchy, layering, security, data, observability |
| `backend.md` | `apps/backend/**` | backend conventions and tests |
| `web-architecture.md` | `apps/web/**` | storefront hierarchy, data flow, state |
| `web.md` | `apps/web/**` | storefront conventions |
| `admin-architecture.md` | `apps/admin/**` | back office hierarchy, data flow, dataProvider |
| `admin.md` | `apps/admin/**` | back office conventions |
| `jira.md` | always | Jira: load the `jira` skill, current sprint, bug priority |
| `git.md` | always | branch and commit naming, protected `main`, PR merge gates |

## Intentional demo behaviour (don't "fix")

These are there on purpose for the workshop:

- `SimulatedLatencyConfig` adds a random 200–1500 ms delay to `/api/**` and `/admin/**`, except images.
- `FlakyHeartbeatJob` (backend) and `lib/flakyHeartbeat` (web/admin) report a synthetic failure to Sentry/GlitchTip about one time in ten.
- `GET /api/debug/boom` always throws.
- `HttpLoggingFilter` logs request and response bodies with secrets redacted.

## API contract

Response and request field names are inherited from an upstream product and are shared by all three apps, including names that look odd: `exploreChefResponseDtoList`, `nameHy`, `dishDtoList`, `createOrderDishes`, translation arrays shaped `[{lang, value}]`. Don't rename API paths or fields. If a change really needs one, update the backend DTOs, `apps/web/src/types` + `api/foodme.ts`, and the admin API/pages together.

## Deploy

On Render's free tier, services cannot *receive* private-network traffic, so every browser-facing or cross-service URL must be a public `*.onrender.com` URL, never a Render `fromService host`. The Dockerfile's JVM flags are tuned so startup fits Render's 512 MB / 0.1 CPU health-check window.

## Known stale references

`.env.example` still refers to `infra/docker-compose.yml` and `docs/`, which were removed from the repo. The CI `e2e` job also needs `infra/docker-compose.yml`, so it only runs when the repo variable `RUN_E2E` is `true`.
