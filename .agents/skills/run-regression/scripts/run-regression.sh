#!/usr/bin/env bash
# Run FoodMe's regression suites and write a summary.
#
# Usage: run-regression.sh [--target local|live] [--suites LIST] [--api URL]
#   --target local  (default) every suite, against a backend on localhost:8081
#   --target live   only the read-only storefront tests, against the Render API
#   --suites        comma list of: backend, web-unit, web-e2e, admin-e2e
#   --api           override the API base URL the e2e tests use
#   --workers N     Playwright workers (default: Playwright's own locally, 1 live)
#
# Results go to test-results/regression/<timestamp>/ (git-ignored):
# summary.md plus one log per suite. Exit code: 0 every suite that ran
# passed, 1 something failed, 2 bad usage, 3 every suite was skipped.

set -u

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LIVE_URL="https://foodme-nairamnatsakanyan.onrender.com"

TARGET="local"
SUITES=""
API=""
WORKERS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --suites) SUITES="$2"; shift 2 ;;
    --api) API="$2"; shift 2 ;;
    --workers) WORKERS="$2"; shift 2 ;;
    -h|--help) sed -n 2,14p "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

case "$TARGET" in
  local) API="${API:-http://localhost:8081}"; SUITES="${SUITES:-backend,web-unit,web-e2e,admin-e2e}" ;;
  live)  API="${API:-$LIVE_URL}";             SUITES="${SUITES:-web-unit,web-e2e}"
         # The free Render instance has 0.1 CPU; parallel tests time out on it.
         WORKERS="${WORKERS:-1}" ;;
  *) echo "--target must be local or live" >&2; exit 2 ;;
esac

OUT="$ROOT/test-results/regression/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
SUMMARY="$OUT/summary.md"
FAILED=0
RAN=0

{
  echo "# Regression run"
  echo
  echo "- Commit: \`$(git -C "$ROOT" rev-parse --short HEAD)\`$( [ -n "$(git -C "$ROOT" status --porcelain)" ] && echo ' (with uncommitted changes)')"
  echo "- Target: $TARGET, API: $API"
  echo "- Started: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo
  echo "| Suite | Result | Passed | Failed | Flaky | Skipped | Notes |"
  echo "|---|---|---|---|---|---|---|"
} > "$SUMMARY"

row() { # suite result passed failed flaky skipped notes
  [ "$2" = SKIPPED ] || RAN=$((RAN + 1))
  echo "| $1 | $2 | $3 | $4 | $5 | $6 | $7 |" >> "$SUMMARY"
  printf '%-10s %-7s passed=%s failed=%s flaky=%s skipped=%s %s\n' "$1" "$2" "$3" "$4" "$5" "$6" "$7"
}

has_suite() { case ",$SUITES," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }

ensure_deps() { # app dir
  [ -d "$1/node_modules" ] || (cd "$1" && npm ci --no-audit --no-fund > "$OUT/npm-ci-$(basename "$1").log" 2>&1)
}

api_up() {
  curl -s -m 180 -o /dev/null -w '%{http_code}' "$API/actuator/health" | grep -q '^200$'
}

# Read a Playwright JSON report and print "passed failed flaky skipped".
pw_counts() {
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).stats || {};
    console.log([r.expected || 0, r.unexpected || 0, r.flaky || 0, r.skipped || 0].join(" "));
  ' "$1" 2>/dev/null || echo "0 0 0 0"
}

# List failed and flaky test titles from a Playwright JSON report.
pw_problems() {
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const walk = (s, path) => {
      for (const c of s.suites || []) walk(c, path.concat(c.title).filter(Boolean));
      for (const sp of s.specs || []) for (const t of sp.tests || []) {
        if (t.status === "unexpected" || t.status === "flaky")
          console.log(`- **${t.status === "flaky" ? "flaky" : "failed"}**: ${sp.file} › ${path.concat(sp.title).join(" › ")}`);
      }
    };
    for (const s of r.suites || []) walk(s, []);
  ' "$1" 2>/dev/null
}

run_playwright() { # suite app-dir grep-file
  local suite="$1" dir="$ROOT/$2" grep_file="${3:-}" args=() report="$OUT/$1.json"
  [ -n "$WORKERS" ] && args+=(--workers "$WORKERS")
  if ! api_up; then
    row "$suite" SKIPPED - - - - "no backend answering at $API/actuator/health"
    return
  fi
  ensure_deps "$dir"
  if [ -n "$grep_file" ]; then
    # Exact titles, one per line, joined into an anchored alternation.
    local pattern
    pattern="$(grep -Ev '^[[:space:]]*(#|$)' "$grep_file" | sed 's/[][\.*^$?+(){}|/]/\\&/g' | paste -sd'|' -)"
    args+=(--grep "($pattern)\$")
    local expected listed
    expected="$(grep -Ecv '^[[:space:]]*(#|$)' "$grep_file")"
    listed="$(cd "$dir" && npx playwright test --list "${args[@]}" 2>/dev/null | grep -c '›')"
    if [ "$listed" != "$expected" ]; then
      echo "WARNING: $suite: $(basename "$grep_file") names $expected tests but $listed matched; a title was renamed or removed." | tee -a "$OUT/warnings.txt"
    fi
  fi
  (cd "$dir" && VITE_API_BASE_URL="$API" PLAYWRIGHT_JSON_OUTPUT_NAME="$report" \
    npx playwright test --retries=1 --reporter=line,json "${args[@]}") > "$OUT/$suite.log" 2>&1
  local code=$?
  if [ ! -s "$report" ]; then
    row "$suite" ERROR - - - - "no report written, see $suite.log"; FAILED=1; return
  fi
  read -r p f fl s <<< "$(pw_counts "$report")"
  local result=PASS
  [ "$code" -ne 0 ] || [ "$f" -gt 0 ] && result=FAIL
  [ "$result" = FAIL ] && FAILED=1
  row "$suite" "$result" "$p" "$f" "$fl" "$s" "log: $suite.log"
  pw_problems "$report" > "$OUT/$suite-problems.md"
}

if has_suite backend; then
  if ! java -version > /dev/null 2>&1; then
    row backend SKIPPED - - - - "no Java runtime; JDK 17 needed"
  else
    (cd "$ROOT/apps/backend" && ./gradlew test --console=plain) > "$OUT/backend.log" 2>&1
    code=$?
    counts="$(node -e '
      const fs = require("fs"), dir = process.argv[1];
      let t = 0, f = 0, s = 0;
      for (const n of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
        if (!n.endsWith(".xml")) continue;
        const m = fs.readFileSync(dir + "/" + n, "utf8").match(/<testsuite[^>]*>/);
        if (!m) continue;
        const a = k => +(m[0].match(new RegExp(` ${k}="(\\d+)"`)) || [0, 0])[1];
        t += a("tests"); f += a("failures") + a("errors"); s += a("skipped");
      }
      console.log([t - f - s, f, s].join(" "));
    ' "$ROOT/apps/backend/build/test-results/test")"
    read -r p f s <<< "$counts"
    result=PASS; { [ "$code" -ne 0 ] || [ "$f" -gt 0 ]; } && { result=FAIL; FAILED=1; }
    row backend "$result" "$p" "$f" - "$s" "log: backend.log"
  fi
fi

if has_suite web-unit; then
  if node -e 'process.exit(require(process.argv[1]).scripts?.test ? 0 : 1)' "$ROOT/apps/web/package.json"; then
    ensure_deps "$ROOT/apps/web"
    (cd "$ROOT/apps/web" && npm test) > "$OUT/web-unit.log" 2>&1
    code=$?
    p="$(grep -Eo 'Tests +[0-9]+ passed' "$OUT/web-unit.log" | grep -Eo '[0-9]+' | head -1)"
    f="$(grep -Eo '[0-9]+ failed' "$OUT/web-unit.log" | tail -1 | grep -Eo '[0-9]+')"
    result=PASS; [ "$code" -ne 0 ] && { result=FAIL; FAILED=1; }
    row web-unit "$result" "${p:-0}" "${f:-0}" - - "log: web-unit.log"
  else
    row web-unit SKIPPED - - - - "apps/web has no test script; see write-unit-tests"
  fi
fi

if has_suite web-e2e; then
  if [ "$TARGET" = live ]; then
    run_playwright web-e2e apps/web "$SKILL_DIR/live-safe-tests.txt"
  else
    run_playwright web-e2e apps/web
  fi
fi

if has_suite admin-e2e; then
  if [ "$TARGET" = live ]; then
    row admin-e2e SKIPPED - - - - "not run against live: it logs in and creates orders"
  else
    run_playwright admin-e2e apps/admin
  fi
fi

{
  echo
  for f in "$OUT"/*-problems.md; do
    [ -s "$f" ] || continue
    echo "## Problems in $(basename "$f" -problems.md)"
    echo
    cat "$f"
    echo
  done
  [ -s "$OUT/warnings.txt" ] && { echo "## Warnings"; echo; sed 's/^/- /' "$OUT/warnings.txt"; echo; }
  if [ "$RAN" -eq 0 ]; then
    echo "Overall: NOTHING RAN (every suite was skipped; see Notes)"
  else
    echo "Overall: $([ "$FAILED" -eq 0 ] && echo PASS || echo FAIL)"
  fi
} >> "$SUMMARY"

echo
tail -1 "$SUMMARY"
echo "Summary: $SUMMARY"
[ "$RAN" -eq 0 ] && exit 3
exit "$FAILED"
