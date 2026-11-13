---
paths:
  - "apps/web/**"
---

# Storefront architecture (`apps/web`)

React 19 + TypeScript + Vite + Tailwind 4, shadcn-style UI, TanStack Query, react-hook-form + zod, i18next, Dexie.

## Hierarchy (`src/`)

```
main.tsx, App.tsx       bootstrap, providers
router.tsx              all routes
pages/                  one folder per route: Home, Explore, Chef, Checkout, OrderStatus, Orders, Tracking, Login, Register
components/
├── ui/                 shadcn-style primitives
├── layout/             app-layout, header, footer, logo
└── sections/           feature blocks (chef-card, dish-modal, user-cart, checkout-summary, ...)
api/                    client.ts (base URL, fetch, auth header) + foodme.ts (every endpoint)
types/index.ts          API payload types, mirrors backend DTOs
schemas/                zod schemas (auth, checkout)
hooks/useCart.ts        cart state
providers/              auth-provider
lib/                    db.ts (Dexie), auth-storage, i18n, sentry, flakyHeartbeat, utils
locales/en/translation.json   UI strings
e2e/                    Playwright specs (dev server on :5180)
```

## Data flow

`page` → `sections` component → TanStack Query hook → `api/foodme.ts` → `api/client.ts` → backend `/api/**`.

## State

- **Server state**: TanStack Query.
- **Cart**: IndexedDB via Dexie (`lib/db.ts`), exposed through `hooks/useCart.ts`. It survives reloads.
- **Customer auth**: `lib/auth-storage.ts`, surfaced by `providers/auth-provider.tsx`. A 401 on `/api/customer*` clears it.
- **Forms**: react-hook-form with zod schemas from `schemas/`.
