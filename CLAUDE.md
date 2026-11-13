# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FoodMe is the system under test for a QA / testing-with-AI workshop. It has three parts: a food-ordering storefront, an admin back office, and a Spring Boot API. All three deploy to Render's free tier from one Docker image. An optional Grafana/Prometheus/Loki monitoring service deploys separately. `README.md` is a step-by-step deploy guide for students who don't code. Keep it that way.

**The app contains deliberate defects. Don't fix them unless explicitly asked.**
- Most are marked in code with `FM-BUG-01` … `FM-BUG-08` comments.
- Some tests assert the buggy behaviour.
- Some later-session defects have no marker, on purpose. If code contradicts a spec, ask before "correcting" it.

The app also has intentional noise: simulated API latency, and "flaky heartbeat" jobs that send fake errors to Sentry/GlitchTip.

Treat the REST API contract (paths and JSON field names) as frozen.

## Layout

- `apps/backend`: Spring Boot 3.3 / Java 17 / Gradle, Postgres + Flyway.
- `apps/web`: customer storefront (React 19 + TS + Vite + Tailwind/shadcn).
- `apps/admin`: back office (React 18 JSX + react-admin/MUI).
- `infra/monitoring`: a single-container Grafana + Prometheus + Loki stack, deployed via `render-monitoring.yaml`. It exposes a Grafana MCP endpoint at `/mcp`; see its `README.md`.
- `render.yaml`: the app blueprint (web service + free Postgres).
- `docs/` and `instructor/`: instructor-only and gitignored. Never commit them.

## How it fits together

- **One origin in production.** `apps/backend/Dockerfile` (build context: repo root) builds both SPAs and bundles them into the Spring jar. The storefront is served at `/`, the admin at `/backoffice`, the customer/public API at `/api/**` and the admin API at `/admin/**`. In production the SPAs call the API with relative URLs. In dev they call `http://localhost:8081`.
- **Building the image:** `docker build -f apps/backend/Dockerfile -t foodme .`. A cold deploy on Render takes 10–15 minutes on 512 MB / 0.1 CPU.

## Rules

Area-specific guidance is in `.claude/rules/`. Each file loads automatically when you work on matching paths:

| Rule | Scope |
|---|---|
| `backend.md` | `apps/backend/**`: structure, security, config, deploy constraints |
| `db.md` | migrations, entities, repositories, test seed |
| `frontend-web.md` | `apps/web/**` |
| `frontend-admin.md` | `apps/admin/**` |
| `testing-backend.md` | `apps/backend/src/test/**` |
| `testing-frontend.md` | Playwright e2e in web and admin |
| `git.md` | always: branches, commits, what never gets committed, PRs |