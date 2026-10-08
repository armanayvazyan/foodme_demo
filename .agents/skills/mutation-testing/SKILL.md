---
name: mutation-testing
description: Use when running mutation testing on a FoodMe pull request or branch diff (apps/backend, apps/web, apps/admin), in CI or locally, to measure whether the unit tests catch deliberate logic changes in the added code.
---

# Mutation testing

You find out whether the unit tests would catch a bug in the code this change added. You make one small, deliberate logic change at a time (a **mutant**), run the module's unit tests, record what happened, and revert. A mutant is **killed** when the tests fail and **survives** when they pass.

You never commit, push, or fix code or tests. Every edit you make is temporary.

## Inputs

CI gives you: the base SHA, `MUTATION_DIR`, the scope file (`$MUTATION_DIR/scope.txt`), the max mutant count, and the modules whose baseline is green. Locally, use these defaults:

```bash
export MUTATION_DIR="$(git rev-parse --show-toplevel)/.mutation"   # git-ignored
bash .agents/skills/mutation-testing/scripts/scope.sh main > "$MUTATION_DIR/scope.txt"
bash .agents/skills/mutation-testing/scripts/run-tests.sh <module> baseline   # once per module, must say SURVIVED
```

`scope.txt` lists the production files you may mutate. It already excludes tests, type-only files, UI primitives, locales and the intentional demo behaviour (`SimulatedLatencyConfig`, `FlakyHeartbeatJob`, `HttpLoggingFilter`, `DebugController`, `flakyHeartbeat`). If it's empty, write `{"mutants": [], "notes": ["No mutable production code changed."]}` and stop.

## 1. Find the added logic

For each file in scope:

- `git diff -U0 <base>...HEAD -- <file>` gives you the added and changed lines. **Only mutate those lines.** Lines the diff didn't touch are out of scope, even in the same method.
- Read the whole file and the tests that exercise it, so you know what the code is supposed to do.
- Skip lines with no behaviour: imports, logging, comments, pure styling (`className`), copy and translation keys, getters/setters, DTO fields without constraints.
- Lines marked `// FM-BUG-nn` are planted workshop bugs. You may mutate them like any other line, but never "fix" them and never report them as findings.

## 2. Design the mutants

Aim for **`MAX_MUTANTS` in total (default 30)**, spread across every file in scope. Add at least one mutant per file that has logic, and spend more of the budget on files with more branches. Each mutant is **one** change at **one** location that a real developer could plausibly make by mistake.

At least **a third** must be **product** mutants. The rest are **classical**.

### Classical operators

| Operator | Example |
|---|---|
| `conditional-boundary` | `>` ↔ `>=`, `<` ↔ `<=` |
| `negate-conditional` | `==` ↔ `!=`, `if (x)` → `if (!x)`, `.equals` → `!…equals` |
| `logical-operator` | `&&` ↔ `\|\|`, drop one operand of a compound condition |
| `arithmetic` | `+` ↔ `-`, `*` ↔ `/`, `+=` → `-=` |
| `increment` | `+ 1` → `- 1`, `i++` → `i--`, drop an off-by-one `- 1` |
| `return-value` | return `null`/`0`/`false`/`""`/`[]`/`Optional.empty()` instead of the value |
| `remove-call` | delete a void call (`save`, `setX`, `invalidateQueries`, `db.products.update`) |
| `literal` | `true` ↔ `false`, a numeric constant ± 1, an empty string |
| `remove-throw` | delete a `throw` or a guard `return` |
| `nullish` | `??` / `\|\|` default removed or changed, `?.` → `.` where it compiles |

### Product operators (FoodMe)

Mutate the **business rule**, not just the operator. Pick the ones that match the code in scope, and name the operator after the rule (e.g. `cash-only-payment`).

| Area | Product mutants |
|---|---|
| Money | Drop the delivery fee from the total; apply free delivery at the wrong threshold (`>` ↔ `>=`, or compare against the total instead of the subtotal); multiply add-on prices by quantity or stop doing so; round with `floor`/`(int)` instead of `Math.round`, or round per line instead of once; use the dish price instead of the price snapshot on `OrderDish`; drop add-ons from the line total |
| Payment and checkout | Accept a payment type other than `CASH`; skip the address requirement for `DELIVERY`, or require it for `TAKEAWAY`; swap `DELIVERY` and `TAKEAWAY`; skip the zod refinement or loosen a `min`/`max` |
| Cart | Allow items from two chefs in one cart (skip the `mismatch` check); let a quantity go below `minimumOrderCount` or below 1; have decrement at the minimum keep the item instead of removing it; key the cart uid without add-ons, so different add-on choices merge; let increment add 2 |
| Order lifecycle | Allow a transition `OrderStatusTransitions` forbids (`DELIVERED → NEW`, `REJECTED → ACCEPTED`); create an order with a status other than `NEW`; let a final status be changed |
| Ownership and auth | Drop the "is this the customer's order" check; compare the wrong id (chef instead of customer); skip lower-casing or trimming the email at login/registration; return a JWT for a wrong password; give `ROLE_CUSTOMER` access to an admin path, or open a protected path with `permitAll` |
| Validation | Remove a `@NotNull`/`@Min`/`@Size`/`@Email` constraint or change its bound; drop a `BadRequestException` branch; return 200 where the code returns 404 (`orElseThrow` → `orElse(null)`) |
| Lists and search | Drop a filter (chef, tag, availability, `active`); reverse the sort; page off by one (`page` vs `page - 1`); return the first page only |
| Translations | `translate()` picks the wrong `lang`, or drops the fallback to the first entry; a Hy/Ru name field mapped from the En one |
| Admin data | `dataProvider` maps a resource to the wrong path; returns `total` from the page length instead of `count`; drops the sort direction; sends `page` without `- 1` |

If the added code has a rule that isn't on this list, write a product mutant for it anyway. The table is a starting point, not a limit.

### Rules

- The mutant must compile and type-check. If `run-tests.sh` says `INVALID` because it doesn't compile, revert it, record it as invalid, and write a different mutant in its place. Invalid mutants don't count towards the budget.
- Don't write **equivalent mutants** (no observable change, e.g. reordering independent statements, or `>=` → `>` on a value that can never be equal). If you only realise afterwards, record it and say so in `note`.
- Never touch test files, `e2e/`, build files or config. The harness rejects those mutants.
- One mutant in the tree at a time.

## 3. Run each mutant

For every mutant, strictly in this order:

1. Apply the change with `Edit`.
2. `bash .agents/skills/mutation-testing/scripts/run-tests.sh <module> <id>` where `<id>` is `M01`, `M02`… (unique across the whole run). The last line is `RESULT: KILLED|SURVIVED|TIMEOUT|INVALID`. It runs the **whole** unit-test suite of that module: `./gradlew test` for backend, `tsc` + `vitest run` for web, `vitest run` for admin.
3. Revert: `git checkout -- <file>`. Then `git status --porcelain -- apps` must print nothing before you start the next mutant.

The harness saves the result, log and patch under `$MUTATION_DIR`. **The report takes each mutant's status from the harness, not from you.** A mutant you list but never ran is reported as `unverified` and counts as survived.

## 4. Record the mutants

Write `$MUTATION_DIR/mutants.json` with `Write`. Update it as you go, so a run that is cut short still has a record:

```json
{
  "mutants": [
    {
      "id": "M01",
      "module": "backend",
      "file": "apps/backend/src/main/java/am/foodme/backend/service/OrderService.java",
      "line": 62,
      "category": "product",
      "operator": "free-delivery-threshold",
      "description": "Free delivery applies when the subtotal equals the threshold",
      "original": "subtotal > chef.getFreeDeliveryFrom()",
      "mutated": "subtotal >= chef.getFreeDeliveryFrom()",
      "note": "Survived: no test orders exactly freeDeliveryFrom. Add one to OrderControllerTest and assert deliveryPrice."
    }
  ],
  "notes": ["Anything a reader should know, e.g. a file you couldn't mutate and why."]
}
```

- `category` is `classical` or `product`. `operator` is a name from the tables above, or your own kebab-case rule name for a product mutant.
- `original` and `mutated` are the changed code fragment only, on one line.
- `note` is required for every **survived** mutant: the missing test case and its correct expected result, and where to add it (the `test-review` skill's "Missing tests" style). For killed mutants it can be empty.
- Don't write counts, a score or a verdict. `report.mjs` computes them from the harness results and the threshold.

## 5. Finish

1. `git status --porcelain -- apps` prints nothing.
2. CI: stop here. The workflow runs `report.mjs finalize`, uploads the report artifact and posts the PR comment.
3. Local: build and print the report:

```bash
node .agents/skills/mutation-testing/scripts/report.mjs finalize --dir "$MUTATION_DIR" \
  --sha "$(git rev-parse HEAD)" --threshold 80 --scope "$MUTATION_DIR/scope.txt"
cat "$MUTATION_DIR/mutation-report.md"
```

## Report schema

`mutation-report.json`, built by `report.mjs finalize`:

| Field | Meaning |
|---|---|
| `summary.mutations` | Scored mutants: killed + survived. Invalid mutants are excluded |
| `summary.killed` | Tests failed, or ran past the timeout |
| `summary.survived` | Tests passed, or the mutant was never run (`unverified`) |
| `summary.score` | `killed / mutations × 100`, one decimal. `null` when there are no mutations |
| `summary.result` | `pass` when `score ≥ threshold`, or when no production code changed. `fail` otherwise, or on an error |
| `modules` | The same counts per module |
| `mutants[]` | Every mutant with `id`, `module`, `file`, `line`, `category`, `operator`, `description`, `original`, `mutated`, `status`, `killedBy`, `note`, `patch` |

The **Mutation Testing Gate** recomputes the summary from `mutants[]` and passes when `result` is `pass` for the PR's latest commit.
