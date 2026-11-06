---
paths:
  - "apps/web/**"
  - "apps/admin/**"
---
# Frontend rules (TypeScript)

- Use TypeScript with explicit types. Don't use `any`.
- Keep data logic in `src/hooks` and `src/lib`, and UI in `src/components`.
- Run ESLint before finishing: `npm run lint` in the app folder.
