#!/usr/bin/env node
// PreToolUse(Edit|MultiEdit|Write): protect files the agent must not change by hand.
//
//  * .env files              -> secrets live there; agents edit .env.example only
//  * package-lock.json        -> regenerate with npm, never hand-edit
//  * applied Flyway migrations -> editing V1..Vn breaks checksum validation on every
//                                 deployed database; add a new V(n+1)__*.sql instead
//  * planted defect markers   -> FM-BUG-NN / FM-FLAKE-NN are training exercises; removing
//                                 one needs an explicit go-ahead
import { execFileSync } from "node:child_process";
import {
  PROJECT_DIR,
  isMain,
  logAction,
  preToolDecision,
  projectedContent,
  readInput,
  relPath,
  run,
} from "./lib/hook-io.mjs";

const MIGRATION_RE = /^apps\/backend\/src\/main\/resources\/db\/migration\/V\d+__.+\.sql$/;
const MARKER_RE = /FM-(?:BUG|FLAKE)-\d+/g;

function trackedInGit(rel) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", rel], {
      cwd: PROJECT_DIR,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function evaluate(rel, before, after, { isTracked = trackedInGit } = {}) {
  if (!rel) return null; // outside the repo: not our business

  if (/(^|\/)\.env(\.(?!example$)[\w.-]+)?$/.test(rel)) {
    return [
      "deny",
      `${rel} holds secrets and is git-ignored. Document new variables in the matching .env.example instead.`,
    ];
  }
  if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(rel)) {
    return [
      "deny",
      `${rel} is generated. Run \`npm install <pkg>\` (or \`npm uninstall\`) in that app instead of editing it.`,
    ];
  }
  if (/(^|\/)gradle\/wrapper\/gradle-wrapper\.(jar|properties)$/.test(rel)) {
    return ["ask", `${rel} pins the Gradle version for everyone. Confirm the upgrade.`];
  }
  if (MIGRATION_RE.test(rel) && before !== null && isTracked(rel)) {
    return [
      "deny",
      `${rel} is an applied Flyway migration; changing it breaks checksum validation on every existing database. Create the next migration (V<next>__description.sql) instead.`,
    ];
  }
  if (before !== null) {
    const removed = [...new Set(before.match(MARKER_RE) || [])].filter(
      (m) => !(after.match(MARKER_RE) || []).includes(m),
    );
    if (removed.length) {
      return [
        "ask",
        `This edit removes planted-defect marker(s) ${removed.join(", ")} from ${rel}. These are intentional training defects. Proceed only if the task is to fix exactly this defect (e.g. its Jira ticket).`,
      ];
    }
  }
  return null;
}

if (isMain(import.meta.url)) {
  run(async () => {
    const input = await readInput();
    const ti = input.tool_input || {};
    const rel = relPath(ti.file_path);
    const { before, after } = projectedContent(input.tool_name, ti);
    const result = evaluate(rel, before, after);
    if (!result) return;
    logAction({
      session: input.session_id,
      event: "guard",
      hook: "guard-files",
      decision: result[0],
      file: rel,
      reason: result[1],
    });
    preToolDecision(result[0], `[foodme guard] ${result[1]}`);
  });
}
