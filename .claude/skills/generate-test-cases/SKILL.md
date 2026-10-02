---
name: generate-test-cases
description: Generate structured, reviewable test cases (manual or automatable) for a FoodMe feature or the whole app. Use when asked to "write test cases", "design tests", "create a test plan" or "what should we test" for the storefront, back-office or API.
---

# Generate test cases

Produce test cases a QA engineer could execute by hand **and** later automate
in Playwright or JUnit/MockMvc.

## 1. Learn the real behaviour first (don't invent it)

Read, at minimum, for the feature in scope:
- the business rules in `AGENTS.md` → "Domain rules"
- the backend service (`apps/backend/src/main/java/am/foodme/backend/service/*`)
  and its controller for exact status codes and error messages
- the web/admin UI component and its zod schema (`apps/web/src/schemas`)
- existing tests (`apps/*/e2e/*.spec.ts`, `apps/backend/src/test/**`) so you
  don't duplicate coverage — note which of your cases are **already
  automated** and where

## 2. Cover these techniques

For each feature, pick cases from several of these, not just the happy path:
- **Happy path** — the primary journey end to end
- **Boundary values** — exactly at / just below / just above a limit
  (min order count, free-delivery threshold, 8-char password, 300-char note)
- **Equivalence classes / negative input** — invalid email, wrong payment
  type, quantity 0 or negative, unknown IDs
- **State transitions** — order status table, cart chef-switch
- **Calculation checks** — totals with quantity × additions + delivery
- **Security** — auth required, another user's data, untrusted HTML/script in
  free-text fields
- **Persistence** — cart survives reload (IndexedDB)

## 3. Output format

Write to the path the user gives (default `docs/test-cases.md`). Start with a
summary table, then one block per case:

```markdown
### TC-<AREA>-<NN>: <short title>
- **Area:** Storefront | Back-office | API
- **Priority:** P1 (blocker) | P2 | P3
- **Type:** Functional | Boundary | Negative | Security | Calculation | State
- **Preconditions:** data/state needed (seed chef, logged-in customer, ...)
- **Steps:**
  1. ...
- **Test data:** concrete values (emails, prices, quantities)
- **Expected result:** observable outcome — exact URL, text, status code, total
- **Automation:** Playwright | MockMvc | Manual-only — and whether it already exists (file:line)
```

Rules for good cases:
- One behaviour per case; expected results must be **checkable** (numbers,
  status codes, visible text), never "works correctly".
- Use concrete data. Compute expected totals explicitly in the case.
- If code behaviour disagrees with the documented rule, write the case
  against the **rule** (expected) and add a line
  `> Note: current code may fail this — see <file>:<line>`. Don't fix code.
- Don't name or enumerate `FM-BUG-*` IDs in the test-case doc — students
  should discover them by running the cases.

## 4. Finish

End with a short coverage matrix (feature × technique) and list any gaps you
deliberately left out.
