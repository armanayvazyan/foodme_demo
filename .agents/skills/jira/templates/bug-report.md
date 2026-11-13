<!--
Bug report template. Modelled on KAN-19 and KAN-23.
Issue type: Task. Summary: "Bug: <what the user sees go wrong>".
Labels: bug, agent-ready, plus area labels (web, admin, backend, cart, checkout, security).
Priority: set from the rubric in SKILL.md. Sprint: assignToSprint "active".
Delete this comment before submitting.
-->
## Summary

<One short paragraph: what goes wrong, who is affected, and the business impact (lost orders, wrong money, support load).>

## Where

<App → page → area, e.g. "Customer storefront → chef page → basket". Name every place that shows the same problem.>

## Steps to reproduce

1. <Start from a clean, named state, e.g. "Open the storefront home page" or "Sign in as a customer".>
2. <Use real names from the seed data, e.g. **Chef Verona**, **Tart with cherry** (1,000 AMD).>
3. <One action per step. Put UI labels in **bold**.>

_Alternative:_ <another way to reproduce it (API call, DevTools edit). Write "None" if there isn't one.>

## Expected result

* <What should happen, as specific as possible (values, messages, states).>

## Actual result

* <What actually happens, with the exact values and messages you observed.>

## More observations

* <Related cases, boundaries you checked, what still works correctly, whether the problem survives a refresh or re-login.>

## Environment

* <Browser and device, signed in or not, and the deployed URL or local setup.>

## Reference

<Seeded defect ID (FM-BUG-nn), a related ticket, a Sentry/GlitchTip event, logs. Write "None" if there is nothing.>

## Definition of done

* The steps above give the expected result.
* <A neighbouring behaviour that must not regress.>
* An automated test covers: <the exact scenario>.
* All automated checks pass.
