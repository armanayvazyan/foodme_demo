# Test judge rubric (step 07)

Judge the Playwright spec `apps/web/e2e/<t>-*.spec.ts` against the cases in `runs/<T>/spec.yaml` and the `test-review` checklist. One item per `test(...)` title, plus `spec` for file-level problems.

| Check | Category | FAIL when |
|---|---|---|
| T1 | `selector-rule` | `data-testid`, a CSS class or element selector (`locator("button.x")`, `[data-...]`), `nth()` on structure, where a role, label or text locator exists. |
| T2 | `fixed-sleep` | `page.waitForTimeout`, `setTimeout`, or any fixed wait. |
| T3 | `non-retrying-assertion` | `expect(await locator.textContent()).toBe(...)`, `expect(await locator.isVisible())`, or any read-then-assert on page state. |
| T4 | `behaviour-mirroring-assertion` | An asserted value (amount, message, count) differs from the matching case's `expected`, or the test asserts values no case states. Quote the assertion and the `expected`. |
| T5 | `house-style` | Signs in without `e2e/auth.ts`; shares state between tests (`fullyParallel` is on); hardcodes the app URL; `test.only`/`test.skip`; the title doesn't name the case id it automates. |

PASS, FAIL and UNSURE mean the same as in `cases.md`. `case_quote` is copied from the spec file, `source_quote` from `spec.yaml` or the checklist.
