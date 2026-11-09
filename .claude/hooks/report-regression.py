#!/usr/bin/env python3
"""PostToolUse hook (Bash): report results after a regression run.

When a Bash command ran the run-regression skill's script, this reads the
summary.md that run wrote and:
- shows the person a one-line result (overall, then each suite's counts);
- gives Claude the full summary, so it reports failures, flaky tests and
  skipped suites rather than just "it passed";
- appends one line per run to test-results/regression/history.md
  (git-ignored), so flaky tests and failures can be compared across runs.

It never blocks, and it stays silent for every other command.
"""
import json
import os
import re
import sys
import time

# The runner as the command being executed (optionally after `cd …&&`, env
# assignments, bash/sh or a timeout), not merely named, as in `cat …/run-regression.sh`.
RUNNER = re.compile(r"(?:^|[;&|(]\s*)(?:\w+=\S*\s+)*(?:(?:bash|sh|zsh|time|timeout\s+\S+)\s+)*"
                    r"(?:\S*/)?run-regression\.sh(?:\s|$|[;&|)])")
SUMMARY_LINE = re.compile(r"Summary: (\S+/summary\.md)")
RECENT_SECONDS = 120


def strings(value):
    """Every string inside the hook payload's tool output, however nested."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings(v)


def find_summary(data, root):
    # The runner prints "Summary: <path>" as its last line.
    for text in strings([data.get("tool_response"), data.get("error")]):
        m = SUMMARY_LINE.findall(text)
        if m and os.path.isfile(m[-1]):
            return m[-1]
    # Output can be truncated; fall back to a summary written in the last
    # couple of minutes. A run sent to the background has none yet: stay quiet.
    base = os.path.join(root, "test-results", "regression")
    newest, newest_time = None, 0
    for name in os.listdir(base) if os.path.isdir(base) else []:
        path = os.path.join(base, name, "summary.md")
        if os.path.isfile(path) and os.path.getmtime(path) > newest_time:
            newest, newest_time = path, os.path.getmtime(path)
    if newest and time.time() - newest_time < RECENT_SECONDS:
        return newest
    return None


def parse(text):
    meta = dict(re.findall(r"^- (Commit|Target|Started): (.+)$", text, re.M))
    suites = []
    for line in text.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 7 and cells[0] not in ("Suite", "---"):
            suites.append(dict(zip(("suite", "result", "passed", "failed", "flaky", "skipped", "notes"), cells)))
    problems = re.findall(r"^- \*\*(failed|flaky)\*\*: (.+)$", text, re.M)
    overall = re.search(r"^Overall: (.+)$", text, re.M)
    return meta, suites, problems, overall.group(1) if overall else "UNKNOWN (run did not finish)"


def suite_text(s):
    if s["result"] == "SKIPPED":
        return f"{s['suite']} skipped ({s['notes']})"
    if s["result"] == "ERROR":
        return f"{s['suite']} ERROR ({s['notes']})"
    parts = [f"{s['passed']} passed", f"{s['failed']} failed"]
    if s["flaky"] not in ("-", "0"):
        parts.append(f"{s['flaky']} flaky")
    if s["skipped"] not in ("-", "0"):
        parts.append(f"{s['skipped']} skipped")
    return f"{s['suite']} {s['result']}: " + ", ".join(parts)


def append_history(root, summary, meta, suites, overall):
    path = os.path.join(root, "test-results", "regression", "history.md")
    new = not os.path.exists(path)
    run = os.path.basename(os.path.dirname(summary))
    if not new:
        with open(path, encoding="utf-8") as f:
            if any(line.startswith(f"| {run} |") for line in f):
                return  # this run is already recorded
    with open(path, "a", encoding="utf-8") as f:
        if new:
            f.write("# Regression history\n\n| Run | Commit | Target | Overall | Suites |\n|---|---|---|---|---|\n")
        target = meta.get("Target", "").split(",")[0]
        f.write(f"| {run} | {meta.get('Commit', '')} | {target} | {overall} | "
                + "; ".join(suite_text(s) for s in suites).replace("|", "/") + " |\n")


def main():
    data = json.load(sys.stdin)
    command = (data.get("tool_input") or {}).get("command", "")
    if not RUNNER.search(command):
        return 0
    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    summary = find_summary(data, root)
    if not summary:
        return 0

    with open(summary, encoding="utf-8") as f:
        text = f.read()
    meta, suites, problems, overall = parse(text)
    append_history(root, summary, meta, suites, overall)

    flaky = sum(1 for kind, _ in problems if kind == "flaky")
    failed = sum(1 for kind, _ in problems if kind == "failed")
    headline = f"Regression {overall.split(' (')[0]}"
    if failed or flaky:
        headline += f" ({failed} failed, {flaky} flaky)"
    message = headline + " · " + " · ".join(suite_text(s) for s in suites)
    rel = os.path.relpath(summary, root)

    print(json.dumps({
        "systemMessage": f"{message}\nFull report: {rel}",
        "hookSpecificOutput": {
            "hookEventName": data.get("hook_event_name") or "PostToolUse",
            "additionalContext": (
                f"report-regression: the regression run finished. Its summary ({rel}) is below. "
                "Report it to the person as the run-regression skill describes: the overall result, "
                "every failed test with the reason from its log, every flaky test, and every skipped "
                "suite with why it was skipped. Don't call a run with skipped suites a full pass.\n\n"
                + text
            ),
        },
    }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)  # a reporting problem must never break the run itself
