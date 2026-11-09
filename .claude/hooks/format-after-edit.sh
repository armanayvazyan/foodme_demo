#!/bin/bash
# PostToolUse (Write|Edit): auto-fix lint issues with the tools the project already has.
# If the tool or node_modules is missing, it silently does nothing.
input=$(cat)
file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
[ -f "$file" ] || exit 0
root="${CLAUDE_PROJECT_DIR:-.}"
case "$file" in
  */apps/web/*.ts|*/apps/web/*.tsx)
    (cd "$root/apps/web" && npx --no-install oxlint --fix "$file") >/dev/null 2>&1 ;;
  */apps/admin/*.js|*/apps/admin/*.jsx|*/apps/admin/*.ts|*/apps/admin/*.tsx)
    (cd "$root/apps/admin" && npx --no-install eslint --fix "$file") >/dev/null 2>&1 ;;
esac
exit 0
