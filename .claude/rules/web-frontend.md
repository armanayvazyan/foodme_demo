---
paths:
  - "apps/web/src/**"
---

# Storefront (apps/web) rules

- TypeScript strict. Import with the `@/` alias, not long relative paths.
- All HTTP goes through `src/api/foodme.ts` (which uses `src/api/client.ts`).
  Components never call `fetch` directly.
- Server data: TanStack Query (`useQuery` / `useMutation`) with array query
  keys like `["chefs", "active", page]`. Cart data: Dexie via `hooks/useCart.ts`.
- Forms: react-hook-form + a zod schema from `src/schemas`. Read field values
  with `useWatch`, not `watch()` (React Compiler can't memoise `watch`).
- Don't call `setState` synchronously inside `useEffect` to reset or derive
  state. Use the "store previous value, compare during render" pattern, or
  derive the value inline.
- Files under `components/ui` and `providers/*.tsx` must export only
  components (react-refresh). Put hooks/constants in a sibling `.ts` file.
- Keep the stable class names e2e tests rely on (`cc_card`, `dc_card`,
  `uc-panel`, `cic_root`, `odf_form`) and accessible names (`"Add to cart"`,
  `"Go to checkout"`, `"Place order"`, form `aria-label="Checkout"`).
- Verify with `npm run lint && npm run build` in `apps/web`.
