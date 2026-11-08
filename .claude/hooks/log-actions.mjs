#!/usr/bin/env node
// Audit log: one JSON line per agent action in .claude/logs/actions.jsonl (git-ignored).
// Registered on SessionStart, UserPromptSubmit, PostToolUse, PostToolUseFailure, Stop, SessionEnd.
// Secrets are redacted and long values truncated. Also records which files the session
// touched, which the Stop quality gate uses.
//
// Query examples:
//   jq -c 'select(.event=="tool")|{ts,tool,summary}' .claude/logs/actions.jsonl | tail
//   jq -r 'select(.event=="guard")|"\(.ts) \(.hook) \(.decision) \(.reason)"' .claude/logs/actions.jsonl
import {
  isMain,
  loadSessionState,
  logAction,
  readInput,
  redact,
  relPath,
  run,
  saveSessionState,
  truncate,
} from "./lib/hook-io.mjs";

export function summarize(tool, ti = {}) {
  switch (tool) {
    case "Bash":
      return redact(truncate(ti.command, 400));
    case "Edit":
    case "MultiEdit":
    case "Write":
    case "Read":
    case "NotebookEdit":
      return relPath(ti.file_path || ti.notebook_path) || ti.file_path;
    case "Glob":
    case "Grep":
      return truncate(`${ti.pattern}${ti.path ? ` in ${relPath(ti.path) || ti.path}` : ""}`, 200);
    case "WebFetch":
    case "WebSearch":
      return truncate(ti.url || ti.query, 200);
    case "Task":
    case "Agent":
      return truncate(ti.description || ti.subagent_type, 200);
    default:
      // MCP tools (e.g. mcp__atlassian__editJiraIssue): keep keys + issue key if any.
      return truncate(
        redact(JSON.stringify(ti.issueIdOrKey ? { issue: ti.issueIdOrKey } : Object.keys(ti))),
        200,
      );
  }
}

if (isMain(import.meta.url)) {
  run(async () => {
    const input = await readInput();
    const event = input.hook_event_name;
    const base = { session: input.session_id, event: event };

    if (event === "PostToolUse" || event === "PostToolUseFailure") {
      const ti = input.tool_input || {};
      const failed =
        event === "PostToolUseFailure" ||
        input.tool_response?.is_error === true ||
        input.tool_response?.interrupted === true;
      logAction({
        ...base,
        event: "tool",
        tool: input.tool_name,
        summary: summarize(input.tool_name, ti),
        ok: !failed,
      });

      if (["Edit", "MultiEdit", "Write", "NotebookEdit"].includes(input.tool_name) && !failed) {
        const rel = relPath(ti.file_path || ti.notebook_path);
        if (rel) {
          const state = loadSessionState(input.session_id);
          if (!state.touched.includes(rel)) state.touched.push(rel);
          saveSessionState(input.session_id, state);
        }
      }
      return;
    }
    if (event === "UserPromptSubmit")
      return logAction({ ...base, prompt: redact(truncate(input.prompt, 500)) });
    if (event === "SessionStart")
      return logAction({ ...base, source: input.source, cwd: input.cwd });
    if (event === "SessionEnd")
      return logAction({
        ...base,
        reason: input.reason,
        touched: loadSessionState(input.session_id).touched,
      });
    logAction(base);
  });
}
