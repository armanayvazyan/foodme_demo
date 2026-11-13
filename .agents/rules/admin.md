---
paths:
  - "apps/admin/**"
---

# Back office conventions

- Keep it plain JS/JSX. Don't introduce TypeScript.
- New resources are wired through `dataProvider.js` and an `api/<resource>-api.js` module. Pages don't call `fetch` directly.
- Use react-admin + MUI components and the theme in `theme/theme.js`. Don't add another UI library.
- Order status values come from `constants/OrderStatus.jsx`. Don't hardcode them.
- Before finishing: `npm run lint` (eslint) and `npm run build` from `apps/admin`.
