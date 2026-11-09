#!/bin/bash
# PreToolUse (Write|Edit): blocks bad tests before they are written
input=$(cat)
file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
text=$(jq -r '.tool_input.content // .tool_input.new_string // empty' <<<"$input")

case "$file" in
  */e2e/*|*/src/test/*|*.spec.*|*.test.*) ;;   # a test file - check it
  *) exit 0 ;;                                  # not a test - skip
esac

if grep -Eq 'waitForTimeout|Thread\.sleep' <<<"$text"; then
  echo "BLOCKED: fixed waits (waitForTimeout / Thread.sleep) are forbidden." >&2
  echo "Wait for a condition instead: await expect(locator).toBeVisible()" >&2
  exit 2
fi
if grep -Eq 'TC-[0-9]+' <<<"$text"; then
  echo "BLOCKED: test IDs must look like FM-<ticket>-<nn>," >&2
  echo "for example FM-SCRUM5-01 (not TC-1)." >&2
  exit 2
fi
exit 0
