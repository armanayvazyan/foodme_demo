#!/usr/bin/env bash
# HUMANS ONLY. Records an approval for one pipeline step and commits it.
# Run it in your own terminal, not through Claude (not even with "!").
#   agentic-workflows/functional-testing/scripts/approve.sh KAN-27 01
#
# Steps you can approve:
#   01 requirements   all questions answered, spec.yaml valid
#   02 plan           plan.md exists
#   04 case judge     latest verdict is UNSURE (or blocked after retries); you decide each check
#   07 test judge     same as 04, for the Playwright spec
#   09 bug draft      lets the agent file the bug draft from the triage file
#   10 report         lets the agent push the report to Qase
set -euo pipefail

if [ -n "${CLAUDECODE:-}" ] || [ ! -t 0 ] || ! (exec </dev/tty) 2>/dev/null; then
  echo "approve.sh is for humans: run it in your own terminal." >&2
  exit 3
fi

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
t="${1:?usage: approve.sh <TICKET> <01|02|04|07|09|10>}"
step="${2:?usage: approve.sh <TICKET> <01|02|04|07|09|10>}"
r="$here/../runs/$t"
rel_r="agentic-workflows/functional-testing/runs/$t"
findings="$here/../runs/findings.jsonl"

[ -d "$here/node_modules" ] || (cd "$here" && npm ci --silent --no-audit --no-fund)
node "$here/state.mjs" "$t" --quiet
st() { node -e 'const s=require(process.argv[1]).steps;const k=Object.keys(s).find(k=>k.startsWith(process.argv[2]));console.log(s[k][process.argv[3]]??"")' "$r/state.json" "$1" "$2"; }

case "$step" in
  01) what="requirements"
      node "$here/validate.mjs" "$t" --requirements --require-answers ;;
  02) what="test plan"
      [ -f "$r/plan.md" ] || { echo "no plan.md yet" >&2; exit 1; } ;;
  04|07)
      what=$([ "$step" = 04 ] && echo "case judge verdict" || echo "test judge verdict")
      s="$(st "$step" status)"
      case "$s" in unsure|blocked) ;; *) echo "step $step is '$s': only an UNSURE or blocked verdict needs you." >&2; exit 1 ;; esac
      file="$(st "$step" file)"
      echo "Verdict $file: for each FAIL / UNSURE check, type a = agree with the judge, o = override."
      node "$here/decide.mjs" "$t" "$r/verdicts/$file" "$findings" </dev/tty ;;
  09) what="bug draft"
      ls "$r"/triage-*.md >/dev/null 2>&1 || { echo "no triage file yet" >&2; exit 1; }
      for f in "$r"/triage-*.md; do node "$here/quote-check.mjs" "$t" "$f"; done ;;
  10) what="report"
      [ -f "$r/report.md" ] || { echo "no report.md yet" >&2; exit 1; } ;;
  *)  echo "unknown step $step (use 01, 02, 04, 07, 09 or 10)" >&2; exit 2 ;;
esac

by="$(git -C "$root" config user.name || echo "$USER")"
read -r -p "Approve the $what for $t as '$by'? Type $t to confirm: " answer </dev/tty
[ "$answer" = "$t" ] || { echo "not approved"; exit 1; }

node --input-type=module -e '
import { appendFileSync } from "node:fs";
import { agentsSha } from "'"$here"'/lib.mjs";
const [file, step, by] = process.argv.slice(1);
appendFileSync(file, JSON.stringify({ step, by, at: new Date().toISOString(), agents_sha: agentsSha() }) + "\n");
' "$r/approvals.jsonl" "$step" "$by"
node "$here/state.mjs" "$t" --quiet

paths=("$rel_r")
[ -f "$findings" ] && paths+=("agentic-workflows/functional-testing/runs/findings.jsonl")
if [ "$step" = 07 ]; then
  spec="$(st 06 spec)"
  [ -n "$spec" ] && paths+=("$spec")
fi
git -C "$root" add -- "${paths[@]}"
git -C "$root" commit -q -o -m "test(qa): approve ${what} (${t})" -- "${paths[@]}"
git -C "$root" log -1 --format='committed %h %s'
