# Case judge rubric (step 04)

Judge `runs/<T>/spec.yaml` against its sources: the ticket text in `acs`, `out_of_scope`, the answered `questions`, and the spec doc named in `sources.doc`. Never judge a case by what the app does: the app may be wrong.

Run every check below. C1 and C2 have one item, `spec`. C3 to C6 have one item per case id.

| Check | Category | PASS when | FAIL when |
|---|---|---|---|
| C1 | `ac-misquoted` | Every `acs[].text` equals the AC in the source doc word for word (bold markers and table pipes aside). | Any word differs, is added or is dropped. Quote both versions. |
| C2 | `gap-missed` | Every ambiguity or contradiction between the ACs and the implementation notes has a question. | A conflict or open decision (a rounding rule, a threshold before or after a change, two sentences that disagree) has no question. Quote the sentences. |
| C3 | `expected-not-from-source` | Every fact in `expected` follows from the `expected_source` text, the launch-code table, the shared setup (prices, delivery fee) and arithmetic. | `expected` adds anything the source doesn't say: UI text, colours, toasts, positions, a number that needs an unanswered rule. Quote the extra words. |
| C4 | `out-of-scope-tested` | The case tests only behaviour that is in scope. | It relies on a feature listed in `out_of_scope`. Quote both. |
| C5 | `steps-not-executable` | The steps name concrete data (dishes, quantities, code, delivery method) and each expected fact can be marked pass or fail by looking at the page. | Vague data ("a valid code", "some items") or a vague result ("everything is correct"). |
| C6 | `duplicate-case` | No other case covers the same AC with the same input partition. | Another case does. Name it. |

Results:

- **PASS**: you checked it and it holds. `case_quote` and `source_quote` may be empty.
- **FAIL**: you can quote the words that break it. `case_quote` is copied from `spec.yaml`, `source_quote` from the source. Both word for word.
- **UNSURE**: the rubric doesn't decide it. Say what a human must decide in `reason`.

The step verdict is `fail` if any check is FAIL, else `unsure` if any is UNSURE, else `pass`.
