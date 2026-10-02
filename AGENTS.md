# FoodMe — agent guide

FoodMe is a home-cooked-food ordering app used as a **QA / DevOps teaching
project**. Customers browse chefs, add dishes to a cart and place cash orders;
staff manage chefs, dishes and orders in a back-office. It ships with
**deliberately planted defects** (see "Planted defects" below) — finding and
testing them is the point of the course.

This file is the tool-agnostic source of truth. `CLAUDE.md` imports it.
Extra rules live in `.agents/rules/`, reusable workflows in `.agents/skills/`.

## Repository map

| Path | What | Stack |
|---|---|---|
| `apps/backend` | REST API on port 8081 | Java 17, Spring Boot 3.3, JPA, Flyway, PostgreSQL (H2 in tests), JWT |
| `apps/web` | Customer storefront (`/`) | React 19, TypeScript, Vite, Tailwind, TanStack Query, Dexie (IndexedDB cart), react-hook-form + zod |
| `apps/admin` | Back-office (`/backoffice`, hash router) | React + JavaScript (JSX), MUI, Vite |
| `apps/*/e2e` | Playwright end-to-end tests | `@playwright/test`, Chromium |
| `infra/monitoring` | Grafana / Prometheus / Loki stack | Docker |
| `render.yaml`, `render-monitoring.yaml` | Render.com blueprints | — |
| `.github/workflows` | CI (build, lint, e2e, docker), Claude PR review, keepalive | GitHub Actions |

The root `package.json` / `src/index.ts` are an IDE scaffold, not part of the app.

## Commands

Run each from the app directory shown.

```bash
# backend (apps/backend)
./gradlew build            # compile + tests (what CI runs)
./gradlew test             # tests only — uses the "test" profile (H2, no Flyway)
./gradlew bootRun          # needs Postgres; see .env.example for DB_* vars

# web (apps/web)
npm ci
npm run lint               # oxlint — must be warning-free
npm run build              # tsc -b && vite build — must type-check
npm run dev                # http://localhost:5173, API from VITE_API_BASE_URL
npx playwright test        # e2e; starts dev server on :5180, needs backend on :8081

# admin (apps/admin)
npm ci
npm run lint               # eslint
npm run build
npm run test:e2e
```

Before saying a change is done, run lint + build for every app you touched, and
the backend tests if you touched `apps/backend`.

## Domain rules (what "correct" means)

- **Cart is single-chef.** Adding a dish from another chef prompts to replace
  the cart. The cart lives in IndexedDB (`apps/web/src/lib/db.ts`), keyed by
  `chefId-dishId-additionIds`.
- **Minimum order count.** A dish's `minimumOrderCount` is the lowest quantity
  allowed; decrementing below it removes the line.
- **Payment** is `CASH` only; anything else → 400.
- **Delivery methods:** `DELIVERY` (needs city + street) or `TAKEAWAY` (free).
- **Delivery price:** free when subtotal is *at or above* the chef's
  `freeDeliveryFrom`; otherwise the chef's `deliveryPrice`.
- **Order total** = Σ (dish price + additions) × quantity + delivery price.
- **Order numbers** look like `FM-1000NN`, from a DB sequence.
- **Order status transitions** (admin): `NEW → ACCEPTED | REJECTED`,
  `ACCEPTED → DELIVERED | REJECTED`. Anything else → 400. A reject reason is
  stored on `REJECTED`.
- **Auth:** customers use `/api/auth/register|login` (JWT bearer); admins use
  `/admin/auth/login` (seed admin `admin` / `admin123`, local only).
- **Validation (web):** name ≥ 2 chars, phone ≥ 8, valid email, password ≥ 8,
  note ≤ 300 chars.

API prefixes: `/api/chef`, `/api/dish`, `/api/order`, `/api/auth`,
`/api/customer`, `/api/images/**`, `/admin/{auth,chef,dish,order}`.
Swagger UI is served by springdoc at `/swagger-ui.html`.

## Planted defects — read before "fixing" anything

Code marked `// FM-BUG-NN` or `{/* FM-BUG-NN */}` is a **deliberate defect**
for students to find. Code marked `FM-FLAKE-NN` is a **deliberately flaky
test**.

- Do **not** fix, refactor away or delete these markers unless the user
  explicitly asks you to fix that specific ID.
- When you do fix one, keep the commit message format
  `Fix <what> (FM-BUG-NN)` and add a regression test.
- Never add a list of the defects to the repo — `docs/planted-defects.md` is
  instructor-only and must not land on `main`.

## Conventions

- **Backend:** controllers stay thin; logic lives in `service/`. Throw
  `BadRequestException` / `NotFoundException` (mapped by `exceptionHandler/`)
  rather than returning error bodies by hand. Paths come from
  `utils/ControllerUtil` constants. Schema changes = a new Flyway file
  `V<n>__<snake_case>.sql` in `src/main/resources/db/migration`, never an edit
  to an existing one.
- **Web:** TypeScript strict; import via the `@/` alias; UI primitives in
  `components/ui`, feature blocks in `components/sections`, pages in
  `pages/<Name>/index.tsx`. Server state through TanStack Query, API calls only
  through `src/api/foodme.ts`. No `setState` inside `useEffect` for derived/reset
  state (oxlint flags it) — adjust state during render instead.
- **Admin:** plain JSX + MUI; keep to the existing `pages/<entity>/<Entity>List|Edit|Show.jsx` layout.
- **E2E:** prefer role/label locators (`getByRole`, `getByLabel`); never use
  `waitForTimeout` in new tests; create test data through the API with unique
  emails (`Date.now()` / UUID) so tests can run in parallel.
- **Commits:** imperative mood, short subject; reference FM IDs when relevant.

## Safety

- Never commit `.env` or real DSNs/tokens; `.env.example` is the template.
- Don't run `git push`, deploy, or touch Render/GitHub settings unless asked.
- `DebugController` (`/api/debug/boom`) throws on purpose for error-tracking demos.
