#!/usr/bin/env node
// PostToolUse(Edit|MultiEdit|Write): format the file Claude just changed with Prettier.
//
// The codebase is not uniformly Prettier-formatted yet, so to avoid noisy diffs:
//   * new files and full rewrites (Write) are always formatted;
//   * edited files are formatted only if they were already Prettier-clean before the edit.
// Prettier is resolved from the app's node_modules, then PATH; if missing the hook is a no-op.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_DIR, isMain, logAction, readInput, relPath, run } from "./lib/hook-io.mjs";

const FORMATTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|md|yml|yaml|html)$/;
const SKIP =
  /(^|\/)(node_modules|dist|build|playwright-report|test-results|\.claude\/logs)\/|package-lock\.json$|\.min\./;

function findPrettier(rel) {
  const app = rel.match(/^apps\/[^/]+\//)?.[0];
  const local = app && path.join(PROJECT_DIR, app, "node_modules", ".bin", "prettier");
  if (local && fs.existsSync(local)) return local;
  const which = spawnSync("sh", ["-c", "command -v prettier"], { encoding: "utf8" });
  return which.status === 0 ? which.stdout.trim() : null;
}

function reconstructBefore(after, toolInput, toolName) {
  const edits = toolName === "MultiEdit" ? toolInput.edits || [] : [toolInput];
  let before = after;
  for (const e of [...edits].reverse()) {
    if (!e.new_string || e.old_string === undefined) return null;
    before = e.replace_all
      ? before.split(e.new_string).join(e.old_string)
      : before.replace(e.new_string, () => e.old_string);
  }
  return before;
}

export function wasClean(prettier, filePath, content) {
  const r = spawnSync(prettier, ["--check", "--stdin-filepath", filePath], {
    input: content,
    encoding: "utf8",
    cwd: PROJECT_DIR,
  });
  return r.status === 0;
}

if (isMain(import.meta.url)) {
  run(async () => {
    const input = await readInput();
    const ti = input.tool_input || {};
    const rel = relPath(ti.file_path);
    if (!rel || !FORMATTABLE.test(rel) || SKIP.test(rel) || !fs.existsSync(ti.file_path)) return;

    const prettier = findPrettier(rel);
    if (!prettier) return;

    if (input.tool_name !== "Write") {
      const after = fs.readFileSync(ti.file_path, "utf8");
      const before = reconstructBefore(after, ti, input.tool_name);
      if (before === null || !wasClean(prettier, ti.file_path, before)) return; // keep diffs minimal
    }

    const r = spawnSync(prettier, ["--write", "--log-level", "warn", ti.file_path], {
      encoding: "utf8",
      cwd: PROJECT_DIR,
    });
    logAction({ session: input.session_id, event: "format", file: rel, ok: r.status === 0 });
    if (r.status !== 0) process.stderr.write(`prettier failed on ${rel}: ${r.stderr}\n`); // non-blocking
  });
}
