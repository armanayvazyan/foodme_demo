#!/usr/bin/env bash
# Step 08: runs the ticket's Playwright spec against the SUT and writes runs/<T>/results.json.
#   run-tests.sh KAN-27            (SUT from spec.yaml "sut", or FT_BASE_URL)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
t="${1:?usage: run-tests.sh <T>}"
r="$here/../runs/$t"
lower="$(echo "$t" | tr '[:upper:]' '[:lower:]')"
spec="$(cd "$root/apps/web" && ls e2e/"$lower"-*.spec.ts 2>/dev/null | head -1)"
[ -n "$spec" ] || { echo "no apps/web/e2e/$lower-*.spec.ts yet (step 06)" >&2; exit 2; }
sut="${FT_BASE_URL:-$(node --input-type=module -e 'import { loadSpec } from "'"$here"'/lib.mjs"; console.log(loadSpec(process.argv[1])?.sut ?? "")' "$t")}"
[ -n "$sut" ] || { echo "no SUT: set sut in spec.yaml or FT_BASE_URL" >&2; exit 2; }

cd "$root/apps/web"
[ -d node_modules ] || npm ci --silent
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
set +e
PLAYWRIGHT_BASE_URL="$sut" VITE_API_BASE_URL="${VITE_API_BASE_URL:-$sut}" PLAYWRIGHT_JSON_OUTPUT_NAME="$r/results.raw.json" \
  npx playwright test "$spec" --reporter=json,list
code=$?
set -e
ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node --input-type=module -e '
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { sha256 } from "'"$here"'/lib.mjs";
const [raw, out, spec, sut, started, ended] = process.argv.slice(1);
const res = JSON.parse(readFileSync(raw, "utf8"));
const tests = res.suites.flatMap(function walk(s) { return [...(s.specs ?? []).flatMap((sp) => sp.tests.map((t) => ({
  title: sp.title, status: t.status,
  results: t.results.map((x) => ({ status: x.status, duration: x.duration, error: x.error?.message ?? null, attachments: (x.attachments ?? []).map((a) => a.path).filter(Boolean) })),
}))), ...(s.suites ?? []).flatMap(walk)]; });
writeFileSync(out, JSON.stringify({ sut, started, ended, spec_hash: sha256(readFileSync(spec, "utf8")), stats: res.stats, tests }, null, 2) + "\n");
unlinkSync(raw);
console.log(`results: ${res.stats.expected} passed, ${res.stats.unexpected} failed, ${res.stats.flaky} flaky -> ${out}`);
' "$r/results.raw.json" "$r/results.json" "$root/apps/web/$spec" "$sut" "$started" "$ended"
node "$here/state.mjs" "$t" --quiet
exit $code
