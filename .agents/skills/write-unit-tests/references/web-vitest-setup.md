# Setting up Vitest in apps/web

Do this once. Check first: if `vitest` is already in `apps/web/package.json`,
skip this file.

## 1. Install

From `apps/web`:

```bash
npm i -D vitest fake-indexeddb
```

`fake-indexeddb` gives Node an in-memory IndexedDB, which the Dexie cart in
`src/lib/db.ts` needs.

## 2. Add the script

```bash
npm pkg set scripts.test="vitest run --dir src"
```

`--dir src` matters. Without it Vitest also collects the Playwright specs in
`e2e/` and fails on every one, because they import `@playwright/test`.

There's no separate Vitest config: Vitest reads `vite.config.ts`, so the `@/`
alias already works.

## 3. Check it

```bash
npm test
npm run build
```

Both should pass. `npm run build` runs `tsc -b`, which type-checks test files
in `src/` along with the app.

## Verified

This setup was tried on 2026-11-06 with Vite 8, Vitest 5.1 and
fake-indexeddb 6.2: `npm test`, `npm run build` and `npm run lint` all passed,
and a cart test failed against the FM-BUG-07 version of `decrementCartItem`
and passed against the fixed one.
