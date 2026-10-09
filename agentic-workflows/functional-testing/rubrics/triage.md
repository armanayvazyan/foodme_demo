# Skeptic rubric (step 09)

You get a hypothesis and an evidence file. Nothing else. One item per claim in the hypothesis (`H-1`, `H-2`...).

| Check | Category | FAIL when |
|---|---|---|
| E1 | `evidence-unverified` | The claim cites a quote id that is not in the evidence file, or cites none. |
| E2 | `hypothesis-unsupported` | The cited quotes don't show what the claim says, or another quote in the evidence contradicts it. Quote both. |

Also ask what else would explain the same quotes. If a simpler explanation fits all the quotes as well, return UNSURE on E2 and name it in `reason`.
