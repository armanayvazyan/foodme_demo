---
paths:
  - "apps/web/**"
---

# Storefront rules

- TypeScript, React 19 and Vite. Import from `src` with the `@/` alias.
- The cart is client-side only: Dexie over IndexedDB, in
  `src/hooks/useCart.ts` and `src/lib/db.ts`. It reaches the server only at
  checkout, so cart bugs are reproducible without signing in.
- API calls go through `src/api/client.ts`. It uses `VITE_API_BASE_URL` when
  set, `http://localhost:8081` in dev, and same-origin in production.
- User-facing text lives in `src/locales/en`.
- Give icon-only buttons an `aria-label`. Playwright tests select them by it.
- `npm run build` is the type check (`tsc -b`), and `npm run lint` runs
  oxlint. Run both before finishing.
