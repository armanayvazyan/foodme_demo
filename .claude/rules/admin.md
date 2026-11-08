---
paths:
  - "apps/admin/**"
---

# Admin back-office (react-admin 5, React 18, MUI 6, plain JS/JSX)

- Data access only through `src/providers/dataProvider.js` and `src/api/*-api.js` (axios).
- Auth: `src/providers/authProvider.js`; admin credentials for local/E2E: `admin` / `admin123`.
- Lint: `npm run lint` (ESLint 9 flat config). E2E: `npm run test:e2e` (port 5174, backend on :8081).
- In production the admin SPA is bundled into the backend at `/backoffice` (see `apps/backend/Dockerfile`).
