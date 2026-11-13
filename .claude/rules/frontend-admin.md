---
paths:
  - "apps/admin/**"
---

# Frontend: back office (`apps/admin`)

React 18 (plain JSX, no TypeScript) + react-admin 5 + MUI 6 + axios + notistack.

## Commands (from `apps/admin`)

```bash
npm ci
npm run dev       # served at /, API defaults to http://localhost:8081
npm run build
npm run lint      # eslint
```

Log in with the seeded `admin` user from Flyway V1.

## Conventions

- **Base path.** Production builds use Vite `base: '/backoffice/'`, because the backend serves admin there and `/admin/**` is the REST API. Dev serves at `/`. Build paths and links from `import.meta.env.BASE_URL`, not hard-coded `/`.
- **HTTP.** Everything goes through the axios instance in `src/api/base-api.js`. It handles the base URL (same as web: `VITE_API_BASE_URL`, else `:8081` in dev, else relative), the JWT header, and the redirect to login on 401. Per-resource calls live in `src/api/*-api.js`.
- **react-admin adapter.** `src/providers/dataProvider.js` maps react-admin's plural resources (`orders`, `chefs`, `dishes`) to the singular backend paths, and `{ list, count }` to `{ data, total }`. Pagination is 0-based on the backend and 1-based in react-admin. Add new resources to `RESOURCE_TO_PATH`.
- **Auth and routing.** Auth lives in `providers/authProvider.js` and `security/ProtectedRoute.jsx` / `GuestRoute.jsx`.
- **Order statuses.** Defined in `constants/OrderStatus.jsx`, which must match the backend enum.
- **Sentry.** Set up in `lib/sentry.js` (`VITE_SENTRY_DSN`; in Docker it comes from the `VITE_SENTRY_DSN_ADMIN` build arg). `lib/flakyHeartbeat.js` reports fake errors on purpose.

## Intentional, don't "fix"

- **Planted defect.** `{/* FM-BUG-08 */}` in `pages/orders/OrderShow.jsx`.
- **Frozen backend contract.**
