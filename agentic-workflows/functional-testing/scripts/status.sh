#!/usr/bin/env bash
# Prints where a functional-testing run stands and the next command.
#   agentic-workflows/functional-testing/scripts/status.sh KAN-27
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
t="${1:?usage: status.sh <TICKET>}"
[ -d "$here/node_modules" ] || (cd "$here" && npm ci --silent --no-audit --no-fund)
node "$here/state.mjs" "$t" --quiet
state="$here/../runs/$t/state.json"
if [ ! -f "$state" ]; then
  echo "$t: no run yet."
  echo "next (agent): claude \"/ft-requirements $t\""
  exit 0
fi
node --input-type=module -e '
import { readFileSync } from "node:fs";
const s = JSON.parse(readFileSync(process.argv[1], "utf8"));
console.log(`${s.run}  (.agents @ ${s.agents_sha})`);
for (const [step, v] of Object.entries(s.steps)) {
  const extra = [];
  if (v.open_questions?.length) extra.push(`open: ${v.open_questions.join(",")}`);
  if (v.approval) extra.push(`approved by ${v.approval.by} ${v.approval.at}`);
  if (v.retries) extra.push(`retries ${v.retries}`);
  if (v.verdict) extra.push(`verdict ${v.verdict}`);
  if (v.mismatch?.length) extra.push(`mismatch: ${v.mismatch.join(",")}`);
  if (v.unexpected) extra.push(`${v.unexpected} failed`);
  console.log(`  ${step.padEnd(16)} ${v.status.padEnd(11)} ${extra.join("; ")}`);
}
const n = s.next;
console.log(`\nnext (${n.who}): ${n.cmd ?? ""}${n.what ? `\n  ${n.what}` : ""}${n.why ? `\n  ${n.why}` : ""}`);
' "$state"
