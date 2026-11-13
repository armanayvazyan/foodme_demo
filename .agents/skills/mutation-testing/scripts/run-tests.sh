#!/usr/bin/env bash
# Runs one module's unit tests against the current working tree and classifies the
# outcome of a mutant. The last line of output is always `RESULT: <STATUS>`.
#
#   KILLED    tests failed            SURVIVED  tests passed
#   TIMEOUT   tests ran too long      INVALID   mutant doesn't compile or touches tests
#
# Usage: run-tests.sh <backend|web|admin> <mutant-id>
#   Use the id `baseline` on an unmutated tree first: it must report SURVIVED (green)
#   and it sets the per-module timeout to 3x its duration (at least 120 s).
#
# Writes $MUTATION_DIR/results/<module>-<id>.json, logs/<module>-<id>.log and
# patches/<module>-<id>.diff (default MUTATION_DIR: <repo>/.mutation).
set -uo pipefail

module=${1:?usage: run-tests.sh <backend|web|admin> <mutant-id>}
id=${2:?usage: run-tests.sh <backend|web|admin> <mutant-id>}
[[ $id =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Mutant id must match [A-Za-z0-9_-]+"; echo "RESULT: INVALID"; exit 2; }

root=$(git rev-parse --show-toplevel)
out=${MUTATION_DIR:-$root/.mutation}
mkdir -p "$out/results" "$out/logs" "$out/patches"
key="$module-$id"
log="$out/logs/$key.log"
patch="$out/patches/$key.diff"

case $module in
  backend) dir=apps/backend; tests_re='^apps/backend/src/test/' ;;
  web)     dir=apps/web;     tests_re='^apps/web/(e2e/|.*\.test\.[jt]sx?$)' ;;
  admin)   dir=apps/admin;   tests_re='^apps/admin/(e2e/|.*\.test\.[jt]sx?$)' ;;
  *) echo "Unknown module: $module"; echo "RESULT: INVALID"; exit 2 ;;
esac

finish() {
  local status=$1 reason=${2:-} seconds=${3:-0} failed=${4:-}
  node -e '
    const [file, id, module, status, reason, seconds, failed, patch] = process.argv.slice(1);
    require("fs").writeFileSync(file, JSON.stringify({
      id, module, status, reason, seconds: Number(seconds),
      failedTests: failed.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10),
      patch,
    }, null, 2));
  ' "$out/results/$key.json" "$id" "$module" "$status" "$reason" "$seconds" "$failed" "${patch#"$root"/}"
  [ -n "$reason" ] && echo "$reason"
  echo "RESULT: $status"
  exit 0
}

cd "$root"
git diff -- "$dir" > "$patch"

if [ "$id" = baseline ]; then
  [ -s "$patch" ] && finish INVALID "Baseline must run on an unmutated tree; $dir has local changes."
else
  [ -s "$patch" ] || finish INVALID "No change under $dir: apply the mutant before running the tests."
  if git diff --name-only -- apps | grep -qE "$tests_re"; then
    finish INVALID "The mutant edits test files. Mutate production code only."
  fi
  if git diff --name-only -- apps | grep -vq "^$dir/"; then
    finish INVALID "The working tree has changes outside $dir. Revert the previous mutant first."
  fi
  if [ -s "$out/scope.txt" ]; then
    outside=$(git diff --name-only -- "$dir" | grep -vxFf "$out/scope.txt" || true)
    [ -z "$outside" ] || finish INVALID "Not in scope.txt, so not code this change added: $outside"
  fi
fi

limit=$(cat "$out/timeout-$module" 2>/dev/null || echo 900)
with_timeout() {
  if command -v timeout > /dev/null; then timeout "$limit" "$@"
  elif command -v gtimeout > /dev/null; then gtimeout "$limit" "$@"
  else perl -e 'alarm shift; exec @ARGV' "$limit" "$@"; fi
}

start=$(date +%s)
cd "$root/$dir"
compile_rc=0
case $module in
  backend)
    with_timeout ./gradlew test --rerun --console=plain > "$log" 2>&1; rc=$? ;;
  web)
    # Vitest strips types without checking them, so type-check first: a mutant that
    # doesn't type-check is invalid, not killed.
    npx --no-install tsc -p tsconfig.app.json --noEmit > "$log" 2>&1 || compile_rc=$?
    rc=$compile_rc
    if [ $compile_rc -eq 0 ]; then with_timeout npx --no-install vitest run >> "$log" 2>&1; rc=$?; fi ;;
  admin)
    with_timeout npx --no-install vitest run > "$log" 2>&1; rc=$? ;;
esac
seconds=$(( $(date +%s) - start ))

if [ "$id" = baseline ]; then
  echo $(( seconds * 3 > 120 ? seconds * 3 : 120 )) > "$out/timeout-$module"
fi

failed=$(grep -E ' FAILED$|^ *FAIL ' "$log" | grep -vE '^> Task|BUILD FAILED' | sort -u || true)

if [ $rc -eq 0 ]; then
  finish SURVIVED "" "$seconds"
elif [ $rc -eq 124 ] || [ $rc -eq 142 ]; then
  [ "$module" = backend ] && ./gradlew --stop > /dev/null 2>&1
  finish TIMEOUT "Tests ran longer than ${limit}s." "$seconds"
elif [ $compile_rc -ne 0 ] ||
     grep -qE "Compilation failed|compileJava FAILED|compileTestJava FAILED|Failed to parse source|Transform failed|PARSE_ERROR" "$log"; then
  finish INVALID "The mutant does not compile. See ${log#"$root"/}." "$seconds"
else
  finish KILLED "" "$seconds" "$failed"
fi
