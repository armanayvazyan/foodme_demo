# Finding categories

Every FAIL or UNSURE check a judge returns maps to one category. `scripts/record.mjs` copies it into `runs/findings.jsonl`, so the retro can count which skill keeps making which mistake.

| Category | Step | What went wrong |
|---|---|---|
| `ac-misquoted` | 01 | An AC in `spec.yaml` is not word for word the ticket's text. |
| `gap-missed` | 01 | The ticket is ambiguous or contradicts itself and no question asks about it. |
| `expected-not-from-source` | 03 | The expected result says something its `expected_source` does not say (invented text, colour, toast, number). |
| `out-of-scope-tested` | 03 | The case tests something the ticket lists as not in this release. |
| `steps-not-executable` | 03 | No concrete data, a step a tester can't do, or an expected result nobody can mark pass or fail. |
| `duplicate-case` | 03 | Same behaviour and same input partition as another case. |
| `selector-rule` | 06 | `data-testid`, CSS classes or DOM structure where a role, label or text locator exists. |
| `fixed-sleep` | 06 | `waitForTimeout` or any fixed wait. |
| `non-retrying-assertion` | 06 | `expect(await locator.x()).toBe(...)` instead of a web-first assertion. |
| `behaviour-mirroring-assertion` | 06 | The asserted value comes from what the app did, not from the case's `expected`. |
| `house-style` | 06 | Other web e2e house rules: sign-in without `e2e/auth.ts`, shared state across tests, hardcoded app URL. |
| `evidence-unverified` | 09 | A quote is not word for word in the raw source it names. |
| `hypothesis-unsupported` | 09 | A claim cites no quote, or the cited quotes don't support it, or other evidence contradicts it. |
