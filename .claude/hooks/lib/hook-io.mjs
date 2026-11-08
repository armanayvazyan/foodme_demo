// Shared helpers for FoodMe Claude Code hooks. Zero dependencies (Node >= 18).
//
// Hook contract (https://code.claude.com/docs/en/hooks):
//   stdin  -> JSON: { session_id, cwd, hook_event_name, tool_name, tool_input, tool_response, ... }
//   stdout -> optional JSON decision; exit 0 = proceed.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
export const LOG_DIR = path.join(PROJECT_DIR, ".claude", "logs");

export async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

/** PreToolUse: "deny" blocks the call, "ask" forces a confirmation prompt. Reason is shown to Claude. */
export function preToolDecision(decision, reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  });
}

/** Adds text to Claude's context without blocking (PostToolUse, SessionStart, UserPromptSubmit). */
export function addContext(hookEventName, additionalContext) {
  emit({ hookSpecificOutput: { hookEventName, additionalContext } });
}

/** PostToolUse / Stop: "block" sends `reason` back to Claude, who must address it. */
export function block(reason) {
  emit({ decision: "block", reason });
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

/** Absolute path -> repo-relative POSIX path ("" if outside the repo). */
export function relPath(filePath) {
  if (!filePath) return "";
  const rel = path.relative(PROJECT_DIR, path.resolve(PROJECT_DIR, filePath));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return "";
  return rel.split(path.sep).join("/");
}

export function readFileOr(filePath, fallback = null) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

/**
 * Content of the file *after* an Edit / MultiEdit / Write would apply.
 * Returns { before, after } (before is null for new files).
 */
export function projectedContent(toolName, toolInput) {
  const before = readFileOr(toolInput.file_path);
  if (toolName === "Write") return { before, after: toolInput.content ?? "" };

  const edits =
    toolName === "MultiEdit"
      ? toolInput.edits || []
      : [
          {
            old_string: toolInput.old_string,
            new_string: toolInput.new_string,
            replace_all: toolInput.replace_all,
          },
        ];
  let after = before ?? "";
  for (const e of edits) {
    if (e.old_string === undefined || e.old_string === "") {
      after = (e.new_string ?? "") + after;
    } else if (e.replace_all) {
      after = after.split(e.old_string).join(e.new_string ?? "");
    } else {
      after = after.replace(e.old_string, () => e.new_string ?? "");
    }
  }
  return { before, after };
}

const SECRET_PATTERNS = [
  [/(authorization:\s*(?:bearer|basic)\s+)[^\s"']+/gi, "$1***"],
  [/((?:password|passwd|secret|token|api[_-]?key|dsn)\s*[=:]\s*)[^\s"'&]+/gi, "$1***"],
  [
    /\b(gh[pousr]_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g,
    "***",
  ],
];

export function redact(text) {
  let out = String(text ?? "");
  for (const [re, rep] of SECRET_PATTERNS) out = out.replace(re, rep);
  return out;
}

export function truncate(text, max = 300) {
  const s = String(text ?? "");
  return s.length > max ? `${s.slice(0, max)}…(+${s.length - max})` : s;
}

/** Append one JSON line to .claude/logs/actions.jsonl. Never throws. */
export function logAction(entry) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    fs.appendFileSync(path.join(LOG_DIR, "actions.jsonl"), `${line}\n`);
  } catch {
    // Logging must never break the agent.
  }
}

// ---- per-session state (files touched etc.), used by the Stop quality gate ----

function statePath(sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(LOG_DIR, "sessions", `${safe}.json`);
}

export function loadSessionState(sessionId) {
  const raw = readFileOr(statePath(sessionId));
  try {
    return raw ? JSON.parse(raw) : { touched: [] };
  } catch {
    return { touched: [] };
  }
}

export function saveSessionState(sessionId, state) {
  try {
    const p = statePath(sessionId);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state, null, 2));
  } catch {
    // ignore
  }
}

/** Run `main` and turn any crash into a non-blocking stderr note (exit 1 = non-blocking error). */
export function run(main) {
  main().catch((err) => {
    process.stderr.write(`[foodme hook] ${err?.stack || err}\n`);
    process.exit(1);
  });
}

/** True when the calling module is the entry point (lets tests import hooks without running them). */
export function isMain(metaUrl) {
  return Boolean(process.argv[1]) && metaUrl === pathToFileURL(path.resolve(process.argv[1])).href;
}
