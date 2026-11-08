---
paths:
  - "apps/web/**"
---

# Storefront web app (React 19, Vite 8, TypeScript, Tailwind 4)

- Imports use the `@/` alias for `src/`. Server state: TanStack Query via `src/api/foodme.ts`.
  Cart: Dexie (IndexedDB) in `src/lib/db.ts` + helpers in `src/hooks/useCart.ts`.
  Forms: react-hook-form + zod schemas in `src/schemas/`. Strings: i18next (`src/locales`).
- Keep logic out of components: put it in `src/lib`, `src/hooks`, `src/schemas` so it is unit-testable.
- Unit tests: Vitest, colocated `*.test.ts` next to the source (`npm run test:unit`).
  `fake-indexeddb` is preloaded in `src/test/setup.ts`, so Dexie works under Node.
- E2E: Playwright in `e2e/` (`npm run test:e2e`), needs the backend on :8081.
- Before finishing: `npx tsc -b` and `npm run lint` (oxlint) must pass — the Stop hook checks it.
