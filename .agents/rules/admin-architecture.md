---
paths:
  - "apps/admin/**"
---

# Back office architecture (`apps/admin`)

React 18 + react-admin 5 + MUI, plain JS/JSX. Served at `/backoffice` in production (Vite `base: '/backoffice/'`), because `/admin/**` is the backend API.

## Hierarchy (`src/`)

```
main.jsx, App.jsx       bootstrap, <Admin> with resources and routes
pages/                  Dashboard, LoginPage, chefs/ (List, Edit), dishes/ (List, Edit), orders/ (List, Show)
layout/                 AppLayout, BackButton
theme/theme.js          MUI theme
providers/
├── dataProvider.js     react-admin ↔ backend mapping
└── authProvider.js     login/logout/checkAuth
api/                    base-api.js (base URL, auth header) + auth/chef/dish/order-api.js
security/               ProtectedRoute, GuestRoute
constants/OrderStatus.jsx
lib/                    sentry, flakyHeartbeat
e2e/                    Playwright specs (dev server on :5174)
```

## Data flow

`page` → react-admin hooks → `providers/dataProvider.js` → `api/*-api.js` → `api/base-api.js` → backend `/admin/**`.

- `dataProvider` maps plural resources (`orders`, `chefs`, `dishes`) to singular backend paths (`/admin/order`, ...) and `{list, count}` to `{data, total}`.
- Sorting is done client-side.
- `authProvider` logs in via `/admin/auth/login` and keeps the JWT in `localStorage.token`.
