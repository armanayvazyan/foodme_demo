#!/usr/bin/env node
// SessionStart: give Claude a 5-line situational briefing so it doesn't have to rediscover it:
//   * current branch, and the Jira ticket if the branch name contains one (SCRUM-123-...)
//   * uncommitted changes
//   * which local services are up (backend :8081, web :5180, admin :5174)
import { execFileSync } from "node:child_process";
import { PROJECT_DIR, addContext, isMain, readInput, run } from "./lib/hook-io.mjs";

const SERVICES = [
  ["backend", "http://localhost:8081/actuator/health"],
  ["web", "http://localhost:5180/"],
  ["admin", "http://localhost:5174/"],
];

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: PROJECT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

async function isUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(400) });
    return res.status < 500;
  } catch {
    return false;
  }
}

export function ticketFromBranch(branch) {
  return branch.match(/\b(SCRUM-\d+)\b/i)?.[1]?.toUpperCase() ?? null;
}

if (isMain(import.meta.url)) {
  run(async () => {
    await readInput();
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    const dirty = git(["status", "--porcelain"]).split("\n").filter(Boolean);
    const up = await Promise.all(SERVICES.map(async ([name, url]) => [name, await isUp(url)]));
    const ticket = ticketFromBranch(branch);

    const lines = [`FoodMe session briefing:`];
    lines.push(
      `- Branch: ${branch || "(not a git repo)"}${["main", "master"].includes(branch) ? " — protected; create a feature branch before committing." : ""}`,
    );
    if (ticket)
      lines.push(
        `- Branch maps to Jira ${ticket}. Load it with the jira skill before starting (summary, acceptance criteria, comments).`,
      );
    lines.push(`- Uncommitted changes: ${dirty.length ? `${dirty.length} file(s)` : "none"}`);
    lines.push(
      `- Local services: ${up.map(([n, ok]) => `${n} ${ok ? "UP" : "down"}`).join(", ")}${up.some(([, ok]) => !ok) ? " (E2E needs all three; see the run-regression skill)" : ""}`,
    );
    addContext("SessionStart", lines.join("\n"));
  });
}
