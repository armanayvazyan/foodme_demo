# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

FoodMe is a food-ordering demo app used for a **QA / observability course**. It is a monorepo:

- `apps/backend`: Spring Boot 3.3 (Java 17, Gradle), PostgreSQL + Flyway, JWT auth
- `apps/web`: customer storefront (React 19 + TypeScript + Vite)
- `apps/admin`: back office (React 18 + react-admin, plain JSX)
- `infra/monitoring`: one-container Prometheus + Loki + Grafana + Grafana MCP (see `infra/monitoring/README.md`)

Area-specific guidance is in `.claude/rules/`. Each file loads automatically when you work on files in its area:
`backend.md`, `database.md`, `frontend-web.md`, `frontend-admin.md`, `testing-backend.md`, `testing-frontend.md`.

## Deliberately planted bugs and flakiness — don't "fix" them unprompted

The code contains intentional defects for students to find. They are marked with `// FM-BUG-NN` comments. Some tests encode the buggy behavior. The repo also has intentional API latency, flaky heartbeat jobs, a `/boom` error endpoint and intentionally flaky e2e specs. Fix or remove any of these only when a task or ticket asks for it.

Fixes are tracked as Jira tickets (e.g. SCRUM-5 fixed FM-BUG-07). Commit style is `fix(scope): description (TICKET-ID)`.

## Running everything locally

1. Start Postgres on `localhost:5432` with db, user and password all `foodme`.
2. Run the backend on `:8081`.
3. Run the two Vite dev servers.

In dev, both SPAs call `http://localhost:8081` unless `VITE_API_BASE_URL` is set. `.env.example` refers to `infra/docker-compose.yml`, which does not exist in this repo.

## Single-origin deployment

`apps/backend/Dockerfile` builds from the **repo root**. It builds both SPAs and copies them into the backend's `static/` resources: the storefront goes to `/` and admin goes to `/backoffice/`. A single Spring Boot jar serves the API and both apps. `SpaWebConfig` sends client-side routes to the right `index.html`. In production both frontends use a relative (same-origin) API base.

- `render.yaml` deploys the app and a Postgres database. `render-monitoring.yaml` deploys the monitoring stack, which has auto-deploy turned off on purpose.
- The service name in `render.yaml` is per student (`foodme-<github-username>`).
- Error-tracker DSNs (`VITE_SENTRY_DSN_WEB`, `VITE_SENTRY_DSN_ADMIN`) are passed as Docker build args and baked into the SPA bundles. `SENTRY_DSN` and `LOKI_PUSH_URL` are read at runtime.
- The student-facing deploy guide is in the root `README.md`.
