# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

FoodMe is a food-ordering demo app used for a **QA / observability course**. It is a monorepo with three apps plus a monitoring stack:

- `apps/backend`: Spring Boot 3.3 (Java 17, Gradle), PostgreSQL + Flyway, JWT auth, Lombok
- `apps/web`: customer storefront. React 19, TypeScript, Vite 8, Tailwind 4, shadcn-style UI (`components/ui`), TanStack Query, react-hook-form + zod, i18next, Dexie (IndexedDB)
- `apps/admin`: back office. React 18, plain JSX, react-admin 5 + MUI, axios
- `infra/monitoring`: one-container Prometheus + Loki + Grafana + Grafana MCP (see `infra/monitoring/README.md`)

### Deliberately planted bugs and flakiness — don't "fix" them unprompted

The code contains intentional defects that students are meant to find. They are marked with `// FM-BUG-NN` comments, for example in `OrderService`, `ChefService`, `CreateOrderDishDto`, `OrderDto` and admin `OrderShow.jsx`. Some e2e specs encode the buggy behavior (e.g. `apps/web/e2e/layout.spec.ts` expects FM-BUG-02). Fix an FM-BUG only when a task or ticket asks for it. Fixes are tracked as Jira tickets (e.g. SCRUM-5 fixed FM-BUG-07); commit style is `fix(scope): description (TICKET-ID)`.

These are also intentional for the demo:
- `SimulatedLatencyConfig`: 200–1500 ms random delay on `/api/**` and `/admin/**` (not `/api/images/**`)
- `FlakyHeartbeatJob` (backend) and `lib/flakyHeartbeat.{ts,js}` (frontends): periodic checks that sometimes fail
- `DebugController` `/boom`: throws so the error tracker has something to show
- `e2e/flake-*.spec.ts` in web: intentionally flaky tests

## Commands

### Backend (`apps/backend`, on Windows use `.\gradlew.bat`)
```
./gradlew bootRun                     # needs Postgres on localhost:5432, db/user/password = foodme
./gradlew test                        # H2 in-memory, profile "test"
./gradlew test --tests am.foodme.backend.OrderControllerTest
./gradlew test --tests 'am.foodme.backend.OrderControllerTest.someMethod'
./gradlew bootJar
```
Tests are `@SpringBootTest` + MockMvc integration tests. They use `application-test.properties`: H2 in PostgreSQL mode, Flyway **disabled**, Hibernate `create-drop`, seed data from `src/test/resources/data.sql`, no latency.

### Web (`apps/web`)
```
npm run dev            # Vite; talks to http://localhost:8081 in dev
npm run build          # tsc -b && vite build
npm run lint           # oxlint
npm run test:e2e       # Playwright; starts dev server on :5180
npx playwright test e2e/happy-path.spec.ts
npm run test:e2e:all   # web + admin e2e
```

### Admin (`apps/admin`)
```
npm run dev / build / lint (eslint)
npm run test:e2e       # Playwright; starts dev server on :5174 (serial, not parallel)
```
The e2e suites run against the Vite dev servers and need the backend running on :8081. Override the targets with `PLAYWRIGHT_BASE_URL` (web) or `ADMIN_BASE_URL` (admin).

## Architecture

### Single-origin deployment
`apps/backend/Dockerfile` builds from the **repo root**. It builds both SPAs and copies them into the backend's `static/` resources: the storefront goes to `/` and admin goes to `/backoffice/`. A single Spring Boot jar serves everything. `SpaWebConfig` sends client-side routes to the right `index.html` and never returns an SPA shell for `api/`, `admin/`, `actuator/`, `swagger-ui` or `v3/` paths. Admin's Vite `base` is `/backoffice/` in production builds only.

Both frontends resolve the API base the same way (`web/src/api/client.ts`, `admin/src/api/base-api.js`): `VITE_API_BASE_URL` if set, otherwise `http://localhost:8081` in dev and `""` (relative) in production.

### Backend layout and URL spaces
Package `am.foodme.backend`: `controller/{api,admin}` → `service` → `repository` (Spring Data JPA, plus custom `DishSearchRepositoryImpl`) → `model`. Data goes in and out through `dto`. Errors go through `exceptionHandler/GlobalExceptionHandler` (`NotFoundException`, `BadRequestException`). Path constants are in `utils/ControllerUtil`.

- `/api/**`: public storefront API. `/api/customer/**` and `POST /api/order` require role CUSTOMER. `/api/auth/**` handles customer login and register.
- `/admin/**`: admin REST API, JWT-protected. Exceptions: `/admin/auth/login`, and `GET /admin/dish/**` is public.
- Security is stateless JWT (`security/JwtService`, `JwtAuthenticationFilter`).

### Database and images
- Flyway migrations are in `src/main/resources/db/migration` (`V{n}__*.sql`), all in schema `foodme`. Hibernate is `ddl-auto=validate`, so every entity change needs a new migration. Don't edit existing ones.
- `DATABASE_URL` in `postgresql://…` form (Render/Neon) is converted to JDBC by `DatabaseUrlEnvironmentPostProcessor`, which is registered in `META-INF/spring.factories`.
- Images are stored in Postgres (`foodme.image`) and served at `/api/images/**`. `ImageSeedRunner` loads `resources/img-seed/` on first start. URLs are stored relative and made absolute per request by `ImageUrlResponseAdvice`. If you add a DTO that carries image URLs, add it to that advice.

### Storefront specifics
- The cart lives client-side in IndexedDB through Dexie (`lib/db.ts`, `hooks/useCart.ts`). A cart can only hold dishes from one chef. Items are keyed by `chefId-dishId-additionIds`, and each item has a `minQuantity` limit.
- Pages are in `src/pages/<Name>/index.tsx`, routes in `router.tsx`. UI strings come from `locales/en/translation.json`. The `@` alias points to `src/`.

### Admin specifics
react-admin with a custom `providers/dataProvider.js` and `authProvider.js` on top of `api/*-api.js`. All admin calls are prefixed with `/admin`. The token is stored in `localStorage` under `token`. A 401 redirects to the login page.

### Observability
- The backend exposes `/actuator/health` and `/actuator/prometheus` and writes JSON logs (logstash encoder). Logs are pushed to Loki only when `LOKI_PUSH_URL` is set (see `logback-spring.xml`).
- `HttpLoggingFilter` logs `/api/**` and `/admin/**` requests and responses, with secrets redacted.
- Errors go to Sentry/GlitchTip: `SENTRY_DSN` for the backend, and `VITE_SENTRY_DSN` baked in at build time for each SPA.

### Deployment
- `render.yaml` deploys the app and a Postgres database. `render-monitoring.yaml` deploys the monitoring stack, which has auto-deploy turned off on purpose.
- The service name in `render.yaml` is per student (`foodme-<github-username>`).
- The student-facing deploy guide is in the root `README.md`.
- `.env.example` refers to `infra/docker-compose.yml`, which does not exist in this repo.
