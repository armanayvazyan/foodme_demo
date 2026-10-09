#!/usr/bin/env node
// PreToolUse guard for the functional-testing pipeline. Exit 2 blocks the tool call.
//   guard.mjs bash   approve.sh / decide.mjs are for humans only
//   guard.mjs write  run files are script-only; no app source edits; e2e house rules;
//                    the ticket's spec only after step 04 passed and step 05 finished
//   guard.mjs qase   Qase writes only after a human approved step 10
//   guard.mjs jira   no Jira writes while a triage bug draft waits for the step 09 approval
// Fails closed: if it can't decide, it blocks.
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const mode = process.argv[2];
const block = (why) => {
  process.stderr.write(`Blocked by .agents/hooks/guard.mjs: ${why}\n`);
  process.exit(2);
};

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  block("could not read the hook input");
}
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const ti = input.tool_input ?? {};

async function scripts() {
  try {
    const lib = await import(resolve(root, "agentic-workflows/functional-testing/scripts/lib.mjs"));
    const st = await import(resolve(root, "agentic-workflows/functional-testing/scripts/state.mjs"));
    return { ...lib, ...st };
  } catch (e) {
    block(`can't load the pipeline scripts (run npm ci in agentic-workflows/functional-testing/scripts): ${e.message}`);
  }
}

if (mode === "bash") {
  const cmd = String(ti.command ?? "");
  if (/approve\.sh|decide\.mjs|approvals\.jsonl/.test(cmd)) block("approvals are for humans. Ask the user to run scripts/approve.sh in their own terminal.");
  if (/(>|tee\s|cp\s|mv\s|sed\s+-i).*runs\/[^ ]*(state\.json|findings\.jsonl|verdicts\/|evidence\/)/.test(cmd)) block("state, verdict, evidence and findings files are written by scripts only.");
  if (/\.auth\//.test(cmd)) block("runs/<T>/.auth/ holds a session token: only session.sh and the browser use it.");
  process.exit(0);
}

if (mode === "write") {
  const abs = resolve(root, String(ti.file_path ?? ti.notebook_path ?? ""));
  const rel = relative(root, abs).split("\\").join("/");
  const text = [ti.content, ti.new_string, ...(ti.edits ?? []).map((e) => e.new_string)].filter(Boolean).join("\n");

  if (/^agentic-workflows\/functional-testing\/runs\/(findings\.jsonl|[^/]+\/(state\.json|approvals\.jsonl|results\.json|verdicts\/|evidence\/|raw\/|\.auth\/))/.test(rel))
    block(`${rel} is written by the pipeline scripts only.`);
  if (/^apps\/backend\//.test(rel) || /^apps\/(web|admin)\/(src|public)\//.test(rel) || /^apps\/(web|admin)\/[^/]+\.(json|ts|js|html)$/.test(rel))
    block(`${rel} is application code or config. The testing pipeline doesn't change the app.`);

  if (/^apps\/(web|admin)\/e2e\//.test(rel)) {
    if (/data-testid/.test(text)) block("no data-testid in e2e specs: use getByRole, getByLabel or getByText (.agents/rules/web.md).");
    if (/waitForTimeout/.test(text)) block("no waitForTimeout: use web-first assertions that retry (await expect(locator).toHaveText(...)).");
    const m = rel.match(/^apps\/web\/e2e\/([a-z]+-\d+)-[^/]*\.spec\.ts$/);
    if (m) {
      const t = m[1].toUpperCase();
      const { buildState } = await scripts();
      const s = buildState(t).steps;
      if (s["04-case-judge"].status !== "pass") block(`step 04 (case judge) is '${s["04-case-judge"].status}' for ${t}; it must pass before the spec is written.`);
      if (s["05-execute"].status !== "done") block(`step 05 (execute) is '${s["05-execute"].status}' for ${t}; every case must be executed before the spec is written.`);
    }
  }
  process.exit(0);
}

if (mode === "qase") {
  const name = String(input.tool_name ?? "");
  if (/__(qase_get|qql_search|qql_help|qase_project_context|qase_discover_tools)$/.test(name)) process.exit(0);
  const { RUNS, buildState } = await scripts();
  const { readdirSync, existsSync } = await import("node:fs");
  const runs = existsSync(RUNS) ? readdirSync(RUNS).filter((d) => /^[A-Z]+-\d+$/.test(d)) : [];
  if (runs.some((t) => buildState(t).steps["10-report"].approval)) process.exit(0);
  block("Qase writes need a human approval of step 10 (scripts/approve.sh <T> 10).");
}

if (mode === "jira") {
  const name = String(input.tool_name ?? "").split("__").at(-1);
  if (/^(get|search|lookup|discover|executeRead|atlassianUserInfo|fetch)/i.test(name) || /^jira_(get|search)/.test(name)) process.exit(0);
  const { RUNS, buildState } = await scripts();
  const { readdirSync, existsSync } = await import("node:fs");
  const runs = existsSync(RUNS) ? readdirSync(RUNS).filter((d) => /^[A-Z]+-\d+$/.test(d)) : [];
  const waiting = runs.filter((t) => {
    const s = buildState(t).steps["09-triage"];
    return s.status === "done" && !s.approval;
  });
  if (waiting.length) block(`the bug draft of ${waiting.join(", ")} waits for a human approval of step 09 before any Jira write.`);
  process.exit(0);
}

block(`unknown guard mode ${JSON.stringify(mode)}`);
