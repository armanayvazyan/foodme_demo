#!/usr/bin/env bash
# FoodMe full regression run: backend (unit + integration) -> web unit -> web E2E -> admin E2E.
#
# Usage:
#   scripts/regression.sh                    # everything
#   scripts/regression.sh --only backend,web-unit
#   scripts/regression.sh --skip-e2e         # fast: no browsers / servers needed
#   scripts/regression.sh --grep "checkout"  # filter Playwright tests by title
#   scripts/regression.sh --start-backend    # boot the backend (needs Postgres on :5432) if :8081 is down
#
# Output: test-results/regression/{<suite>.log, *.json, summary.md}; exit code 1 if anything failed.
# E2E prerequisites: backend on :8081 (web/admin dev servers are started by Playwright itself).
# Env passthrough: PLAYWRIGHT_BASE_URL, ADMIN_BASE_URL, VITE_API_BASE_URL, PW_CHROMIUM_PATH,
#                  GRADLE_ARGS (extra args for ./gradlew, e.g. an --init-script mirror).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/test-results/regression"
SUITES="backend,web-unit,web-e2e,admin-e2e"
GREP=""
START_BACKEND=0
API="${VITE_API_BASE_URL:-http://localhost:8081}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) SUITES="$2"; shift 2 ;;
    --skip-e2e) SUITES="backend,web-unit"; shift ;;
    --grep) GREP="$2"; shift 2 ;;
    --start-backend) START_BACKEND=1; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

rm -rf "$OUT" && mkdir -p "$OUT"
has() { [[ ",$SUITES," == *",$1,"* ]]; }
log() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
STATUS_FILE="$OUT/status.tsv"; : > "$STATUS_FILE"
record() { printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "$STATUS_FILE"; } # suite, exit|skipped, seconds

run_suite() { # name, dir, command...
  local name="$1" dir="$2"; shift 2
  log "$name  ($dir: $*)"
  local start=$SECONDS
  ( cd "$ROOT/$dir" && "$@" ) 2>&1 | tee "$OUT/$name.log"
  local code=${PIPESTATUS[0]}
  record "$name" "$code" "$((SECONDS - start))"
}

backend_up() { curl -sf -o /dev/null --max-time 2 "$API/actuator/health"; }

ensure_npm_deps() {
  [[ -d "$ROOT/apps/$1/node_modules" ]] || ( cd "$ROOT/apps/$1" && npm ci --no-audit --no-fund )
}

# ---------------------------------------------------------------- backend
if has backend; then
  run_suite backend apps/backend ./gradlew test --console=plain ${GRADLE_ARGS:-}
  cp -r "$ROOT/apps/backend/build/test-results/test" "$OUT/backend-junit" 2>/dev/null || true
fi

# ---------------------------------------------------------------- web unit
if has web-unit; then
  ensure_npm_deps web
  run_suite web-unit apps/web npx vitest run --reporter=default --reporter=json --outputFile.json="$OUT/web-unit.json"
fi

# ---------------------------------------------------------------- E2E
if has web-e2e || has admin-e2e; then
  if ! backend_up && [[ $START_BACKEND == 1 ]]; then
    log "starting backend (./gradlew bootRun) — log: $OUT/backend-server.log"
    ( cd "$ROOT/apps/backend" && nohup ./gradlew bootRun --console=plain ${GRADLE_ARGS:-} > "$OUT/backend-server.log" 2>&1 & )
    for _ in $(seq 1 60); do backend_up && break; sleep 3; done
  fi
  if ! backend_up; then
    echo "Backend is not reachable at $API — skipping E2E. Start it (Postgres + ./gradlew bootRun) or pass --start-backend." | tee "$OUT/e2e-skipped.log"
    has web-e2e && record web-e2e skipped 0
    has admin-e2e && record admin-e2e skipped 0
    SUITES="${SUITES//web-e2e/}"; SUITES="${SUITES//admin-e2e/}"
  fi
fi

PW_ARGS=(--reporter=list,json --trace=retain-on-failure)
[[ -n "$GREP" ]] && PW_ARGS+=(--grep "$GREP")

if has web-e2e; then
  ensure_npm_deps web
  PLAYWRIGHT_JSON_OUTPUT_FILE="$OUT/web-e2e.json" run_suite web-e2e apps/web npx playwright test "${PW_ARGS[@]}"
fi
if has admin-e2e; then
  ensure_npm_deps admin
  PLAYWRIGHT_JSON_OUTPUT_FILE="$OUT/admin-e2e.json" run_suite admin-e2e apps/admin npx playwright test "${PW_ARGS[@]}"
fi

# ---------------------------------------------------------------- summary
node "$ROOT/scripts/regression-summary.mjs" "$OUT" | tee "$OUT/summary.md"
! awk -F'\t' '$2 != "0" && $2 != "skipped" { bad=1 } END { exit !bad }' "$STATUS_FILE"
