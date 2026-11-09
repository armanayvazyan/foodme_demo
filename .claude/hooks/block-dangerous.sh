#!/bin/bash
# PreToolUse (Bash): блокирует опасные команды
input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")

block() { echo "BLOCKED: $1" >&2; exit 2; }

grep -Eq 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)' <<<"$cmd" \
  && block "rm -rf is not allowed. Delete specific files one by one."
grep -Eq 'git[[:space:]]+push[^;&|]*[[:space:]](main|master)([[:space:]]|$)' <<<"$cmd" \
  && block "Pushing to main is not allowed. Push a feature branch and open a pull request."
grep -Eq 'git[[:space:]]+push[^;&|]*(--force|[[:space:]]-f)([[:space:]]|$)' <<<"$cmd" \
  && block "Force push is not allowed."
exit 0
