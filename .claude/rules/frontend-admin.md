---
paths:
  - "apps/admin/**"
---

# Admin back office rules (`apps/admin`)

React 18, plain JavaScript/JSX (no TypeScript in `src/`), react-admin 5, MUI 6, axios.

## Commands
```
npm run dev      # Vite at root "/"; calls the backend at http://localhost:8081
npm run build    # vite build; production base is /backoffice/
npm run lint     # eslint
```

## Base path
In production the backend serves this app at `/backoffice`, not `/admin`, because `/admin/**` is the backend's JWT-protected REST API. `vite.config.js` sets `base: '/backoffice/'` only in production mode. Build in-app links and redirects from `import.meta.env.BASE_URL` (see `LOGIN_PATH` in `api/base-api.js`), never from hardcoded `/`.

## Data flow
Pages (`src/pages/<resource>/`) → react-admin `providers/dataProvider.js` / `authProvider.js` → `src/api/*-api.js` → `api/base-api.js`.
- `base-api.js` adds the `/admin` prefix to every request, so pass paths like `/chef`, not `/admin/chef`.
- The axios response interceptor returns `response.data` directly.
- The token is stored in `localStorage` under `token`. A 401 removes it and redirects to the login page.
- Routes are guarded by `security/ProtectedRoute.jsx` and `security/GuestRoute.jsx`.
- Order statuses are defined in `constants/OrderStatus.jsx`.

## Intentional demo behavior
`// FM-BUG-08` in `pages/orders/OrderShow.jsx` is a planted bug. `lib/flakyHeartbeat.js` fails sometimes on purpose. Leave both unless a ticket asks for a change.
