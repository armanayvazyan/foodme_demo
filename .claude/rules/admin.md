---
paths:
  - "apps/admin/**"
---

# Admin rules

- Plain JavaScript and JSX with react-admin 5 and MUI 6. Don't add TypeScript
  files here.
- react-admin resources go through `src/providers/dataProvider.js`; the HTTP
  clients are in `src/api/`. The admin API is under `/admin/**` and needs the
  JWT from `/admin/auth/login`, except `GET /admin/dish/**`, which is public.
- In production the app is served at `/backoffice/` (`base` in
  `vite.config.js`); locally it runs at `/`. Don't hard-code either path.
- Run `npm run build` and `npm run lint` (eslint) before finishing.
