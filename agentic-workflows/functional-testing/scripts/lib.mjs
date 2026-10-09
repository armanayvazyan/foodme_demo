// Shared helpers for the functional-testing scripts. No side effects on import.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const WF = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = resolve(WF, "../..");
export const RUNS = join(WF, "runs");

export const STEPS = [
  "01-requirements", "02-plan", "03-cases", "04-case-judge", "05-execute",
  "06-automate", "07-test-judge", "08-run", "09-triage", "10-report",
];
export const CASE_STATUS = ["draft", "judged", "executed", "automated", "passing"];
export const EXEC_RESULT = ["match", "mismatch", "blocked"];
export const VERDICT = ["pass", "fail", "unsure"];
export const CHECK_RESULT = ["PASS", "FAIL", "UNSURE"];

export function ticketArg(argv = process.argv) {
  const t = argv[2];
  if (!t || !/^[A-Z]+-\d+$/.test(t)) {
    console.error(`usage: ${argv[1]} <TICKET e.g. KAN-27>`);
    process.exit(2);
  }
  return t;
}

export const runDir = (t) => join(RUNS, t);
export const specPath = (t) => join(runDir(t), "spec.yaml");

// apps/web/e2e/kan-27-<slug>.spec.ts
export function e2eSpecFor(t) {
  const dir = join(ROOT, "apps/web/e2e");
  const prefix = `${t.toLowerCase()}-`;
  const hit = existsSync(dir) && readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith(".spec.ts"));
  return hit ? join(dir, hit) : null;
}

export function readText(p) {
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

export function readJson(p) {
  const s = readText(p);
  return s == null ? null : JSON.parse(s);
}

export function readJsonl(p) {
  const s = readText(p);
  if (!s) return [];
  return s.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

export function loadSpec(t) {
  const s = readText(specPath(t));
  return s == null ? null : YAML.parse(s);
}

export const sha256 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);

// Hash of the parts a case judge looks at, so a verdict can be marked stale.
export function casesHash(spec) {
  return sha256(JSON.stringify((spec?.test_cases ?? []).map(({ execution, status, spec: s, ...rest }) => rest)));
}

function git(...args) {
  try {
    return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// Last commit that touched .agents/, plus "+dirty" if .agents/ has local changes.
export function agentsSha() {
  const sha = git("log", "-1", "--format=%h", "--", ".agents") ?? "unknown";
  const dirty = git("status", "--porcelain", "--", ".agents");
  return dirty ? `${sha}+dirty` : sha;
}

export const gitUser = () => git("config", "user.name") ?? process.env.USER ?? "unknown";
