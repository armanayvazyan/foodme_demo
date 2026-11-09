#!/bin/bash
# PostToolUse (все инструменты): пишет журнал действий
input=$(cat)
tool=$(jq -r '.tool_name // "?"' <<<"$input")
detail=$(jq -r '.tool_input.command // .tool_input.file_path // ""' <<<"$input" | head -c 200)
dir="${CLAUDE_PROJECT_DIR:-.}/.claude/logs"
mkdir -p "$dir"
echo "$(date '+%F %T') | $tool | $detail" >> "$dir/actions.log"
exit 0
