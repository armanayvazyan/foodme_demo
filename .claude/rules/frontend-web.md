---
paths:
  - "apps/web/**"
---

# Frontend: storefront (`apps/web`)

React 19 + TypeScript + Vite, Tailwind (zinc base, no CSS variables), shadcn/Radix (`src/components/ui`), react-hook-form + zod (`src/schemas`), i18next, Dexie.

## Commands (from `apps/web`)

```bash
npm ci
npm run dev       # API defaults to http://localhost:8081
npm run build     # tsc -b && vite build; type errors fail the build
npm run lint      # oxlint
```

## Conventions

- **Import alias.** `@/` → `src/`.
- **API calls.** All HTTP goes through `src/api/client.ts` (`request<T>`, `ApiRequestError`). Endpoint functions live in `src/api/foodme.ts`, and their types in `src/types`. Don't call `fetch` directly from components.
- **Base URL.** `VITE_API_BASE_URL` wins when set. Otherwise the base is `http://localhost:8081` in dev and `""` (same origin) in prod, because the backend serves this SPA at `/`.
- **Auth.** The customer JWT is in `lib/auth-storage.ts` (localStorage) and is exposed through `providers/auth-provider.tsx`. On a 401 the stored auth is cleared.
- **Cart.** The cart persists in IndexedDB via Dexie (`lib/db.ts`, DB `FoodMeCart`) and is used through `hooks/useCart.ts`.
- **Copy.** User-facing strings go in `src/locales/en/translation.json` (English only). Don't hard-code new copy.
- **Pages and router.** Pages live in `src/pages/<Name>/index.tsx`, and routes in `src/router.tsx`.
- **Sentry.** Set up in `lib/sentry.ts`. `VITE_SENTRY_DSN` is baked in at build time; in the Docker image it comes from the `VITE_SENTRY_DSN_WEB` build arg.

## Intentional, don't "fix"

- **Planted defect.** `// FM-BUG-07` in `hooks/useCart.ts`.
- **Fake errors.** `lib/flakyHeartbeat.ts` reports a fake error to Sentry about one tick in ten. It has no visible effect in the UI.
- **Frozen backend contract.** Adapt the UI to the API, not the other way round.
