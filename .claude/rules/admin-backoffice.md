---
paths:
  - "apps/admin/**"
---

# Back-office (apps/admin) rules

- Plain JavaScript/JSX with MUI. Do not introduce TypeScript here.
- Pages follow `pages/<entity>/<Entity>List.jsx | Edit.jsx | Show.jsx`.
- Routes needing a login are wrapped in `security/ProtectedRoute.jsx`.
- Never render user-supplied text with `dangerouslySetInnerHTML`. Customer
  order notes are untrusted input (see the planted `FM-BUG-08`, which is left
  in on purpose — don't copy that pattern elsewhere).
- Order status changes must respect the backend transition table
  (NEW → ACCEPTED/REJECTED, ACCEPTED → DELIVERED/REJECTED). Only offer
  valid next statuses in the UI.
- Verify with `npm run lint && npm run build` in `apps/admin`.
