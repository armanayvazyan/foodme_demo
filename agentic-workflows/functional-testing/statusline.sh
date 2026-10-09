#!/usr/bin/env bash
# Claude Code status line: shows the STLC step of the most recently updated run.
# The pipeline skill writes the line to runs/<T>/status; this only prints it.
cat >/dev/null # Claude Code sends session JSON on stdin; not needed here

runs="${CLAUDE_PROJECT_DIR:-$PWD}/agentic-workflows/functional-testing/runs"
latest=$(ls -t "$runs"/*/status 2>/dev/null | head -n 1)

if [ -n "$latest" ]; then
  head -n 1 "$latest"
else
  echo "Feature Testing │ no run yet │ /feature-testing-pipeline <ticket>"
fi
