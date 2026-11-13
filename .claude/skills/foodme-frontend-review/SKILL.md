---
name: foodme-frontend-review
description: Use when asked to review frontend code in FoodMe - a diff, branch, PR or files under apps/web (React 19 + TS storefront) or apps/admin (react-admin back office), including their Playwright e2e specs. Triggers - "review the frontend", "review the web/admin changes", "check this component", "frontend code review".
---

# FoodMe frontend code review

Read-only review of changes under `apps/web/**` and `apps/admin/**`. Output is a verified findings list. Never edit code, commit, or post to GitHub unless explicitly asked.

## 0. Ground rules (read first)

- **Planted defects.** `FM-BUG-07` (`apps/web/src/hooks/useCart.ts`), `FM-BUG-08` (`apps/admin/src/pages/orders/OrderShow.jsx`) and any other `FM-BUG-nn` lines, plus specs asserting them (e.g. `layout.spec.ts` for FM-BUG-02), are intentional. List them under "Known planted defects" only if the diff touches them; never count them as new findings.
- **Unmarked defects exist on purpose.** Report what you find locally, but never put findings into commit messages, PR descriptions or PR comments without asking first; students' agents read GitHub. If asked to post, warn once, then do it.
- **Intentional noise.** `lib/flakyHeartbeat.*` fake Sentry errors, `flake-*.spec.ts` flaky specs, simulated API latency. Not findings.
- **Frozen backend contract.** The UI adapts to the API. A frontend change that requires a renamed path or JSON field is a **Blocker**.
- Load `.claude/rules/frontend-web.md`, `frontend-admin.md`, `testing-frontend.md` before judging.

## 1. Resolve the target

| Input | Diff command |
|---|---|
| nothing | `git diff main...HEAD -- apps/web apps/admin` plus `git diff HEAD -- apps/web apps/admin` |
| branch name | `git diff main...<branch> -- apps/web apps/admin` |
| PR number | `gh pr diff <n>`, keep only `apps/web/**` / `apps/admin/**` hunks; `gh pr view <n>` for intent |
| path(s) | review those files as they are now |

Split the diff into **web** and **admin**; apply the matching section of the checklist. If both are empty, say so and stop. Note the ticket/intent.

## 2. Build context, not just hunks

Read each changed file whole, then one hop out: the components that render it, the hooks/providers it uses, the API function and its type, and the backend DTO/controller it talks to (`apps/backend/src/main/java/am/foodme/backend/dto|controller`) to confirm field names, nullability, pagination base and status values.

## 3. Checklist — shared (web + admin)

### Correctness
- Behaviour matches the ticket/spec: prices, totals, quantities, limits, status labels, empty/edge inputs.
- Money: no float accumulation errors shown to users; same rounding/format as the backend returns.
- Async: loading, error and empty states all handled; no unhandled promise rejections; double-submit prevented on mutating actions.
- Race conditions: stale responses overwriting newer ones (search, pagination, filters); requests after unmount.
- React state: no stale closures (functional `setState` when deriving from previous); effect dependencies complete and not looping; no state that should be derived; stable, unique `key`s (not array index on reorderable lists).
- Auth: 401 handling preserved (web clears stored auth; admin redirects to login); protected routes stay protected; no token in URLs or logs.
- Contract: field names, optional/nullable fields, enum values and 0- vs 1-based pagination match the backend exactly.

### UX and accessibility
- Interactive elements are real buttons/links with accessible names; inputs have labels; dialogs trap focus and close on Escape.
- **e2e depends on roles and labels** (`getByRole`, `getByLabel`). Renaming visible/accessible text or changing roles silently breaks specs — check `apps/web/e2e/**` and `apps/admin/e2e/**` for the old text.
- Responsive layout not broken; no layout shift on load; disabled states visible.

### Security
- No `dangerouslySetInnerHTML` with API data; no `eval`; no secrets in code (only `VITE_*` public config).
- User input validated client-side *and* not trusted as the only check.

### Tests
- New user-visible behaviour has an e2e spec following existing style: role/label locators, web-first assertions, no fixed waits, unique `e2e-<timestamp>-<rand>@example.com` customers, no clean-DB assumptions.
- `flake-*.spec.ts` and planted-defect assertions untouched.
- **Parametrize when possible (rule).** Two or more specs that differ only in data (invalid form inputs, several dishes/chefs, statuses, viewports) must be one data-driven block: a `const cases = [...]` array with `for (const c of cases) { test(\`... ${c.name}\`, async ({ page }) => { ... }) }` inside `test.describe`, with a unique title per case. Copy-pasted specs that could be parametrized are a **Minor** finding; name the specs to merge. Keep separate tests only when steps or assertions genuinely differ.

## 4. Checklist — web (`apps/web`, React 19 + TS)

- HTTP only via `src/api/client.ts` (`request<T>`, `ApiRequestError`); endpoint functions in `src/api/foodme.ts`; types in `src/types`. No `fetch` in components.
- Types: no `any`/unsafe casts hiding contract mismatches; exhaustive handling of union/enums (order status).
- Forms: react-hook-form + zod schema in `src/schemas`; schema rules match backend validation; errors shown per field.
- Copy: every new user-facing string in `src/locales/en/translation.json` via i18next; no hard-coded text.
- Cart (Dexie `FoodMeCart`, `lib/db.ts`, `hooks/useCart.ts`): schema changes bump the Dexie version with an upgrade path; quantities and totals consistent between cart, checkout and order request.
- UI: reuse `src/components/ui` (shadcn/Radix) before adding new primitives; Tailwind zinc palette, no CSS variables; `@/` import alias.
- Routing: pages in `src/pages/<Name>/index.tsx`, registered in `src/router.tsx`; deep links work with SPA fallback.

## 5. Checklist — admin (`apps/admin`, React 18 JSX + react-admin 5 + MUI 6)

- HTTP only via the axios instance in `src/api/base-api.js`; per-resource calls in `src/api/*-api.js`.
- Paths and links built from `import.meta.env.BASE_URL` (prod base is `/backoffice/`); no hard-coded `/`.
- `providers/dataProvider.js`: new resources added to `RESOURCE_TO_PATH`; `{ list, count }` → `{ data, total }`; page conversion 1-based (react-admin) ↔ 0-based (backend) correct both ways; sort/filter params forwarded.
- `constants/OrderStatus.jsx` still matches the backend enum; status transitions offered in UI are ones the backend accepts.
- react-admin idioms: `useNotify`/notistack for feedback, `useRefresh` after mutations, no manual state copies of record data.
- No TypeScript in admin; prop shapes still consistent.

## 6. Run checks

- web: `cd apps/web && npm run build && npm run lint` (build runs `tsc -b`; type errors fail it).
- admin: `cd apps/admin && npm run build && npm run lint`.
- Run `npm ci` first only if `node_modules` is missing.
- e2e (`npm run test:e2e`) only if a backend is up on `:8081` (or `VITE_API_BASE_URL` set); otherwise list it as not run.

Attribute each failure: caused by the diff, pre-existing on `main`, or a planted/flaky spec. Don't claim checks pass without running them.

### Stability gate for added or changed tests (10 runs)

Every e2e test added or modified in the diff must pass **10 out of 10** runs to count as passing. List them from the diff (`test(...)` titles in added/changed hunks), then run each with retries off:

```bash
cd apps/web     # or apps/admin
npx playwright test e2e/<file>.spec.ts -g "<test title>" --repeat-each=10 --retries=0 --reporter=line
```

`--retries=0` matters because CI config retries (web 2, admin 1) would hide flakiness. For a parametrized block, every case must pass in all 10 runs.

- 10/10: passed.
- 1–9/10: **flaky**. Report it as a **Major** finding with the failing run's error and trace (`npx playwright show-report`). Name the likely cause: fixed waits, non-web-first assertions, shared data, cold-start latency, or animation timing. Exception: a new test inside an intentional `flake-*.spec.ts` is expected to be flaky. Note it, don't flag it.
- 0/10: failing. Attribute the cause as above.

This gate needs the backend on `:8081`. If it isn't up, say the added tests are **unverified**, not passed. Report the score per test in the Checks section (e.g. `checkout › rejects empty address 10/10`).

## 7. Verify every finding

Re-read the code for each candidate and drop it unless you can state a **concrete failure**: user action/state → wrong UI, wrong request, crash, broken e2e or a11y barrier. Mark kept findings **Confirmed** (traced, reproduced, or build/lint output) or **Plausible**. Drop style opinions that contradict existing repo patterns. To confirm a UI behaviour live, use `playwright-cli` against the dev server.

## 8. Report

Severity: **Blocker** (contract break, security hole, broken build/deploy, checkout or login broken) · **Major** (wrong behaviour users hit) · **Minor** (edge case, missing state/test, a11y gap) · **Nit**.

Per finding: severity, confidence, app (web/admin), `file:line`, one-line defect, failure scenario, suggested fix in words (no patch unless asked).

Write the full report as one self-contained HTML file in the session scratchpad (`frontend-review-<target>.html`) and `open` it. In chat give: target, check results per app, counts by severity, top findings one line each. Sections:

1. Summary and verdict (approve / approve with nits / request changes)
2. Findings, most severe first, grouped web / admin
3. Known planted defects touched (if any)
4. Checks run and results
5. Not reviewed / out of scope (backend hunks → suggest `foodme-backend-review`)
