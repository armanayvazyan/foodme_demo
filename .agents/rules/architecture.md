# System architecture

## Repo hierarchy

```
apps/
├── backend/   Spring Boot 3.3 / Java 17 / Gradle, Postgres + Flyway, JWT auth
├── web/       customer storefront (React 19 + TS + Vite + Tailwind 4)
└── admin/     back office (React 18 + react-admin 5 + MUI, plain JS/JSX)
infra/monitoring/stack/   Prometheus + Loki + Grafana + Grafana MCP (one container)
render.yaml, render-monitoring.yaml   Render one-click blueprints
```

Each app has its own build. There is no workspace tooling at the root. App details live in `backend-architecture.md`, `web-architecture.md` and `admin-architecture.md`.

## How the apps connect

```
browser ──► storefront (/)         ──► /api/**    public + customer REST (ROLE_CUSTOMER for /api/customer/**, POST /api/order)
browser ──► back office (/backoffice) ──► /admin/** admin REST (JWT, admin role)
                                         │
                                         ▼
                              backend ──► Postgres (schema foodme)
```

## One origin in production

`apps/backend/Dockerfile` builds both SPAs and copies them into the jar's `static/` resources, so the backend serves everything from one host:

- `/` is the storefront. `/backoffice` is the admin SPA (admin Vite build uses `base: '/backoffice/'` in production only).
- `/api/**` is the public/customer REST API. `/admin/**` is the JWT-protected admin REST API. That's why the admin UI lives at `/backoffice`, not `/admin`.
- `SpaWebConfig` sends extensionless paths to the matching `index.html`. It never serves an SPA shell for `api/`, `admin/`, `actuator/`, `swagger-ui` or `v3/`.

Both frontends use a relative API base in production builds and `http://localhost:8081` under `vite dev`. `VITE_API_BASE_URL` overrides both (`apps/web/src/api/client.ts`, `apps/admin/src/api/base-api.js`). `VITE_*` values are baked in at build time.

`apps/web/vercel.json`, `apps/admin/vercel.json` and the per-app Dockerfiles/nginx configs are for standalone deploys. The Render blueprint uses only the backend Dockerfile.
