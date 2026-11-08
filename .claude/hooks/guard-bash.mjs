#!/usr/bin/env node
// PreToolUse(Bash): block or confirm dangerous shell commands.
//   deny -> Claude cannot run it (and is told why + what to do instead)
//   ask  -> the human gets a confirmation prompt, even in auto/accept modes
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import {
  PROJECT_DIR,
  isMain,
  logAction,
  preToolDecision,
  readInput,
  run,
  truncate,
} from "./lib/hook-io.mjs";

const PROTECTED_BRANCHES = ["main", "master"];

function currentBranch() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: PROJECT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/** Split a command line into simple commands on ; && || | and newlines (quotes respected, roughly). */
export function splitCommands(cmd) {
  const parts = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) {
      if (c === quote) quote = null;
      cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      cur += c;
      continue;
    }
    if (c === ";" || c === "\n" || c === "|" || c === "&") {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function tokens(simple) {
  return (simple.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, ""));
}

/** Drop leading env assignments / wrappers so "FOO=1 sudo git push" -> ["git","push"]. */
function strip(tok) {
  const t = [...tok];
  while (
    t.length &&
    (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0]) ||
      ["sudo", "command", "env", "time", "nohup"].includes(t[0]))
  )
    t.shift();
  return t;
}

function checkGitPush(t, branch) {
  const args = t.slice(2);
  const flags = args.filter((a) => a.startsWith("-"));
  const positional = args.filter((a) => !a.startsWith("-"));

  if (flags.includes("--no-verify")) {
    return [
      "deny",
      "`git push --no-verify` skips the repo's safety hooks. Fix what the hook reports instead.",
    ];
  }
  if (
    flags.some((f) => f === "--force" || f === "-f" || /^-[a-zA-Z]*f/.test(f) || f === "--mirror")
  ) {
    return [
      "deny",
      "Force-push rewrites shared history. If you really need it on your own feature branch, use `--force-with-lease` (requires confirmation).",
    ];
  }
  if (flags.some((f) => f.startsWith("--force-with-lease"))) {
    return [
      "ask",
      "Force-push with lease: confirm this branch is yours and nobody else pushed to it.",
    ];
  }
  if (
    flags.includes("--delete") ||
    flags.includes("-d") ||
    positional.some((p) => p.startsWith(":"))
  ) {
    return ["ask", "This deletes a remote branch. Confirm it is safe."];
  }
  // Refspecs: everything after the remote name.
  const refspecs = positional.slice(1);
  const targetsProtected = refspecs.some((r) => {
    const dst = r.includes(":") ? r.split(":").pop() : r;
    return PROTECTED_BRANCHES.includes(dst.replace(/^refs\/heads\//, "").replace(/^\+/, ""));
  });
  const implicitProtected = refspecs.length === 0 && PROTECTED_BRANCHES.includes(branch);
  if (targetsProtected || implicitProtected || flags.includes("--all")) {
    return [
      "deny",
      `Pushing to ${PROTECTED_BRANCHES.join("/")} is not allowed. Push a feature branch (e.g. \`git push -u origin SCRUM-123-short-name\`) and open a PR.`,
    ];
  }
  return null;
}

function isDangerousRmTarget(target) {
  const home = os.homedir();
  const t = target.replace(/\/+$/, "") || "/";
  if (
    ["/", "~", "$HOME", "${HOME}", ".", "..", "*", "./*", "../*", "/*", "~/*", ".git"].includes(t)
  )
    return true;
  if (t.startsWith("$") || t.includes("..")) return true; // unexpanded vars / escaping the tree
  const abs = path.resolve(PROJECT_DIR, t.replace(/^~(?=$|\/)/, home));
  if (abs === PROJECT_DIR || abs === home || abs === "/") return true;
  if (!abs.startsWith(PROJECT_DIR + path.sep) && !abs.startsWith(os.tmpdir())) return true; // outside the repo
  if (/(^|\/)\.git(\/|$)/.test(path.relative(PROJECT_DIR, abs))) return true;
  return false;
}

export function evaluate(command, branch = "") {
  const reasons = { deny: [], ask: [] };
  const add = (r) => r && reasons[r[0]].push(r[1]);

  if (/curl[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b|wget[^|]*\|\s*(ba|z)?sh\b/.test(command)) {
    add([
      "deny",
      "Piping a download straight into a shell is not allowed. Download, read, then run.",
    ]);
  }
  if (/:\(\)\s*\{\s*:\|:&\s*\};:/.test(command)) add(["deny", "Fork bomb."]);

  for (const simple of splitCommands(command)) {
    const raw = tokens(simple);
    const t = strip(raw);
    const [bin, sub] = t;
    if (!bin) continue;
    if (raw[0] === "sudo") add(["ask", "Command uses sudo."]);

    if (bin === "git") {
      if (sub === "push") add(checkGitPush(t, branch));
      if (sub === "commit" && t.includes("--no-verify"))
        add(["deny", "`--no-verify` bypasses commit hooks. Fix the reported problem instead."]);
      if (sub === "reset" && t.includes("--hard"))
        add(["ask", "`git reset --hard` discards uncommitted work."]);
      if (sub === "clean" && t.some((a) => /^-[a-zA-Z]*f/.test(a)))
        add(["ask", "`git clean -f` permanently deletes untracked files."]);
      if ((sub === "checkout" || sub === "restore") && t.includes("."))
        add(["ask", "This discards all local changes in the working tree."]);
      if (
        sub === "branch" &&
        t.some((a) => a === "-D") &&
        t.some((a) => PROTECTED_BRANCHES.includes(a))
      )
        add(["deny", "Deleting main/master is not allowed."]);
      if (sub === "filter-branch" || (sub === "update-ref" && t.includes("-d")))
        add(["deny", "History rewriting is not allowed from the agent."]);
    }

    if (bin === "rm") {
      const flags = t
        .slice(1)
        .filter((a) => a.startsWith("-"))
        .join("");
      const recursive = /r|R|--recursive/.test(flags);
      const force = /f|--force/.test(flags);
      const targets = t.slice(1).filter((a) => !a.startsWith("-"));
      if (recursive && targets.some(isDangerousRmTarget)) {
        add([
          "deny",
          `Refusing \`${truncate(simple, 120)}\`: recursive delete of the repo root, home, /, .git, a glob, a variable or a path outside the project. Delete specific build folders instead (e.g. apps/web/dist).`,
        ]);
      } else if (recursive && force && targets.length === 0) {
        add(["deny", "`rm -rf` without an explicit target."]);
      }
    }

    if (bin === "chmod" && t.some((a) => /^(0?777|a\+rwx)$/.test(a)))
      add(["deny", "World-writable permissions (777) are not allowed."]);
    if (
      bin === "mkfs" ||
      bin.startsWith("mkfs.") ||
      (bin === "dd" && t.some((a) => a.startsWith("of=/dev/")))
    )
      add(["deny", "Raw disk operation."]);
    if (bin === "npm" && sub === "publish")
      add(["deny", "Publishing packages is not allowed from the agent."]);
    if (bin === "gh" && sub === "repo" && t[2] === "delete")
      add(["deny", "Deleting repositories is not allowed."]);
    if (bin === "gh" && sub === "pr" && t[2] === "merge")
      add(["ask", "Merging a PR: confirm reviews and CI are green."]);
    if (
      bin === "docker" &&
      ((sub === "system" && t[2] === "prune") ||
        (sub === "volume" && ["rm", "prune"].includes(t[2])) ||
        (t.includes("-v") && sub === "compose" && t.includes("down")))
    ) {
      add(["ask", "This deletes Docker volumes (including the local Postgres data)."]);
    }
    if (
      ["cat", "less", "more", "head", "tail", "bat", "source", "."].includes(bin) &&
      t.slice(1).some((a) => /(^|\/)\.env(\.(?!example)[\w.-]+)?$/.test(a))
    ) {
      add([
        "deny",
        "`.env` files hold secrets. Read `.env.example` for the variable names instead.",
      ]);
    }
    if (/^(psql|mysql|sqlite3)$/.test(bin) || bin.endsWith("gradlew")) {
      if (/\b(drop\s+(database|schema|table)|truncate\s+table?)\b/i.test(simple))
        add(["ask", "Destructive SQL statement."]);
    }
  }
  if (/\b(drop\s+(database|schema))\b/i.test(command) && !reasons.ask.length)
    add(["ask", "Destructive SQL statement."]);

  if (reasons.deny.length) return { decision: "deny", reason: reasons.deny.join(" ") };
  if (reasons.ask.length) return { decision: "ask", reason: reasons.ask.join(" ") };
  return null;
}

if (isMain(import.meta.url)) {
  run(async () => {
    const input = await readInput();
    const command = input.tool_input?.command || "";
    const result = evaluate(command, currentBranch());
    if (!result) return;
    logAction({
      session: input.session_id,
      event: "guard",
      hook: "guard-bash",
      decision: result.decision,
      command: truncate(command),
      reason: result.reason,
    });
    preToolDecision(result.decision, `[foodme guard] ${result.reason}`);
  });
}
