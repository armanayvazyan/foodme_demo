---
paths:
  - "apps/web/**"
---

# Storefront rules (`apps/web`)

React 19, TypeScript, Vite 8, Tailwind 4, shadcn-style UI primitives in `src/components/ui`, TanStack Query, react-hook-form + zod (`src/schemas`), i18next, Dexie (IndexedDB).

## Commands
```
npm run dev      # Vite; calls the backend at http://localhost:8081
npm run build    # tsc -b && vite build (type errors fail the build)
npm run lint     # oxlint (not eslint)
```

## Structure
- Pages are in `src/pages/<Name>/index.tsx`, and routes are in `src/router.tsx`.
- Feature components go in `src/components/sections`, layout in `src/components/layout`, and generic primitives in `src/components/ui`.
- The `@` import alias points to `src/`.
- Shared types are in `src/types/index.ts`.
- UI strings come from `src/locales/en/translation.json` through i18next. Don't hardcode user-facing text.

## API
- All calls go through `src/api/client.ts`, with endpoints wrapped in `src/api/foodme.ts`.
- The base URL is `VITE_API_BASE_URL` if set, otherwise `http://localhost:8081` in dev and `""` (same origin) in production. In production the backend serves this SPA at `/`.
- A 401 from `/api/customer/**` clears the stored auth (`lib/auth-storage.ts`).

## Cart
- The cart lives client-side in IndexedDB (`lib/db.ts`, `hooks/useCart.ts`). It is not stored on the server.
- A cart can hold dishes from only one chef. `addDishToCart` returns `"mismatch"` unless `replaceOtherChef` is set.
- Items are keyed by `chefId-dishId-sortedAdditionIds`, and each item has a `limitations.minQuantity` limit.

## Build-time env
`VITE_SENTRY_DSN` is baked in at build time (`lib/sentry.ts`). `lib/flakyHeartbeat.ts` fails sometimes on purpose for the QA course. Leave it in place.
