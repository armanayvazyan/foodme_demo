#!/bin/bash
# PreToolUse (Write|Edit): не даёт записать пароли и ключи в файлы
input=$(cat)
text=$(jq -r '.tool_input.content // .tool_input.new_string // empty' <<<"$input")
pattern="(password|passwd|api[_-]?key|secret|token)[\"']?[[:space:]]*[:=]"
pattern+="[[:space:]]*[\"'][^\"']{8,}[\"']"
if grep -Eiq "$pattern" <<<"$text"; then
  echo "BLOCKED: looks like a hard-coded secret." >&2
  echo "Read it from an environment variable (process.env.X) instead." >&2
  exit 2
fi
exit 0
