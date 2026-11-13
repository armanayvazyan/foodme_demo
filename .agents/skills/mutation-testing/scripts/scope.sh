#!/usr/bin/env bash
# Prints the production files a mutation run may touch: files under apps/ that the
# change added or modified, minus tests, generated/type-only code and the
# intentional demo behaviour listed in CLAUDE.md.
#
# Usage: scope.sh <base-ref>        (diffs <base-ref>...HEAD)
set -euo pipefail

base=${1:?usage: scope.sh <base-ref>}
cd "$(git rev-parse --show-toplevel)"

git diff --name-only --diff-filter=AM "$base"...HEAD -- apps/ |
  grep -E '^apps/backend/src/main/java/.+\.java$|^apps/web/src/.+\.tsx?$|^apps/admin/src/.+\.jsx?$' |
  grep -vE '\.test\.[jt]sx?$' |
  grep -vE '/(SimulatedLatencyConfig|FlakyHeartbeatJob|HttpLoggingFilter|DebugController|FoodmeBackendApplication)\.java$' |
  grep -vE '^apps/web/src/(components/ui/|types/|locales/|main\.tsx$|lib/(flakyHeartbeat|sentry|i18n)\.ts$)' |
  grep -vE '^apps/admin/src/(theme/|main\.jsx$|lib/(flakyHeartbeat|sentry)\.js$)' ||
  true
