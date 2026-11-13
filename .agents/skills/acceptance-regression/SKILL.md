---
name: acceptance-regression
description: Use when asked to run regression, smoke or acceptance testing of FoodMe against a deployed or local environment using the cases in test-cases/ (TC-01…TC-05), driving the storefront and back office through Claude in Chrome.
---

# Acceptance regression with Claude in Chrome

The cases in `test-cases/` (index in `test-cases/README.md`) are the source of truth. Run every step of every case, record a result per step, and report. Don't rewrite the cases while running them.

Default environment: `https://foodme-armanayvazyan-xw9i.onrender.com/` (storefront `/`, back office `/backoffice`). Use the URL the user gives if different.

## 1. Plan the run around sign-in

TC-03 steps 3–4, TC-04 and TC-05 need a signed-in customer and admin.

| Host | Who signs in |
|---|---|
| `localhost`, `127.0.0.1`, `*.localhost`, `*.test` | You may, with test credentials from the project's seed/fixture files. |
| Anything else (e.g. `*.onrender.com`) | **The user.** You may not type passwords or create accounts there, even though the admin login page prints sandbox credentials. |

On a non-local host:
1. Run all signed-out steps first: TC-01, TC-02, and TC-03 steps 1, 2 and 5.
2. Leave the tabs ready: storefront on `/chef/24` with 1 × Pho Bo in the cart, and a second tab on `/backoffice`.
3. Stop and ask the user to sign in to both tabs, and to do TC-03 step 3 (wrong password) themselves and tell you what the page showed.
4. Resume with TC-03 step 4, then TC-04 and TC-05.

## 2. Setup

- Load all Chrome tools in one ToolSearch call: `tabs_context_mcp, tabs_create_mcp, tabs_close_mcp, navigate, computer, find, get_page_text, javascript_tool, read_network_requests, read_console_messages`.
- Start with `tabs_context_mcp`, then use a fresh tab.
- **The cart persists across sessions.** Check the header badge on `/`. If it isn't 0, empty the cart through the UI (**Remove item** in the order panel) before TC-01 step 4 and TC-02.

## 3. Driving the app reliably

- **Every `/api/**` and `/admin/**` call has a random 200–1500 ms delay** (intentional). The page is often blank right after `navigate`. Never click coordinates straight after a navigation. Wait for the element to exist first:

```js
// javascript_tool: wait for an element, act, then read state back
const sel = 'button[aria-label="Add Pho Bo soup with beef to cart"]';
for (let i = 0; i < 20 && !document.querySelector(sel); i++) await new Promise(r => setTimeout(r, 500));
document.querySelector(sel).click();
await new Promise(r => setTimeout(r, 800));
({
  badge: [...document.querySelectorAll('header a, header button')].map(b => b.innerText.trim()).filter(t => /^\d+$/.test(t)),
  panel: [...document.querySelectorAll('aside,section,div')].find(e => e.innerText?.startsWith('Your order'))?.innerText.replace(/\n+/g, ' | '),
})
```

- Useful accessible names: `Add <dish name> to cart` (the card's **+**, adds directly) and `Remove item` (cart panel). Clicking the dish **card** instead opens a quantity dialog with **Add to cart**, which is a different path.
- Check expected text with `get_page_text` or a JS read of `main`. Use a screenshot only when you need coordinates or to check layout.
- **Chrome's autofill dropdown** can cover form fields and error messages. Read validation errors from the DOM, not the screenshot.
- **"No request is sent" checks:** network tracking only starts on the first `read_network_requests` call. Call it with `clear: true` and `urlPattern: "/api/"` *before* the action, then read again afterwards. Ignore `/api/images/...` noise.
- Don't click controls that open native `alert`/`confirm` dialogs. They freeze the extension.

## 4. When a step fails

1. Retry once after an explicit wait, because the latency can make a correct app look broken.
2. Localize the fault. Call the API behind the screen from the page, e.g. `await fetch('/api/chef/active?page=0&size=12').then(r => r.json())`. Endpoints are in `apps/web/src/api/foodme.ts` and `apps/admin/src/api/`. If the API is already wrong, it's a backend bug; if the API is right, it's a UI bug.
3. Record the actual vs expected result and the evidence (URL, API response, screenshot).

Not defects (intentional, see `CLAUDE.md`): the API latency, the Sentry/GlitchTip heartbeat failures, `GET /api/debug/boom`, and body logging.

## 5. Test data

- TC-04 and TC-05 create and change **real orders** on the target environment. Put `TC-04 regression <date>` in the order note so they're identifiable.
- TC-05 step 6 needs a second NEW order. Use the TC-04 takeaway order (step 6).

## 6. Report

End with one table, one row per case:

| TC | Result | Details |
|---|---|---|

- Result is one of: ✅ Pass, ❌ Fail (name the step), ⚠️ Partial (list the steps that ran), ⏸ Blocked (give the reason).
- Details: what was checked, and for failures the actual vs expected result and where the fault is (API or UI).
- Put findings outside the cases under a separate **Other observations** list.
- Don't file Jira bugs unprompted. Offer to, and if the user agrees, load the `jira` skill first.
- Close the tabs you created, unless you're handing them to the user to sign in.
