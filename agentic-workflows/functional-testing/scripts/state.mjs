#!/usr/bin/env node
// Builds runs/<T>/state.json from the run's files. The only writer of state.json.
//   node state.mjs <T>          write state.json, print it
//   node state.mjs <T> --quiet  write state.json only
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, agentsSha, casesHash, e2eSpecFor, loadSpec, readJson, readJsonl, readText, runDir, sha256, ticketArg } from "./lib.mjs";
import { validate } from "./validate.mjs";

const MAX_RETRIES = 2;

function verdicts(r, step) {
  const dir = join(r, "verdicts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(`${step}-`) && f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: f, ...readJson(join(dir, f)) }));
}

const approvalOf = (approvals, step) => approvals.filter((a) => a.step === step).at(-1) ?? null;

// Judge step: latest verdict, stale if the judged input changed, retries = fail verdicts.
function judged(list, currentHash, approval) {
  const latest = list.at(-1);
  const retries = list.filter((v) => v.verdict === "fail").length;
  if (!latest) return { status: "pending", retries };
  const base = { verdict: latest.verdict, file: latest.file, model: latest.model ?? null, retries };
  if (latest.input_hash !== currentHash) return { ...base, status: "stale" };
  if (latest.verdict === "pass") return { ...base, status: "pass" };
  const status = latest.verdict === "unsure" ? "unsure" : retries > MAX_RETRIES ? "blocked" : "fail";
  // A human approval after an UNSURE or blocked verdict settles the step.
  if (status !== "fail" && approval && approval.at >= latest.recorded_at) return { ...base, status: "pass", resolved_by: approval.by };
  return { ...base, status };
}

export function buildState(t) {
  const r = runDir(t);
  const approvals = readJsonl(join(r, "approvals.jsonl"));
  const s = {};
  let spec = null;
  let specError = null;
  try {
    spec = loadSpec(t);
  } catch (e) {
    specError = e.message;
  }

  // 01 requirements
  if (!spec) s["01-requirements"] = { status: specError ? "fail" : "pending", error: specError };
  else {
    const v = validate(t, spec, { requirementsOnly: true });
    const open = (spec.questions ?? []).filter((q) => !(q.answer ?? "").toString().trim()).map((q) => q.id);
    s["01-requirements"] = { status: v.ok ? "done" : "fail", fails: v.fails.length, open_questions: open };
  }
  s["01-requirements"].approval = approvalOf(approvals, "01");

  // 02 plan
  s["02-plan"] = { status: existsSync(join(r, "plan.md")) ? "done" : "pending", approval: approvalOf(approvals, "02") };

  // 03 cases
  const cases = spec?.test_cases ?? [];
  if (!cases.length) s["03-cases"] = { status: "pending" };
  else {
    const v = validate(t, spec);
    s["03-cases"] = { status: v.ok ? "done" : "fail", cases: cases.length, fails: v.fails.map((f) => `${f.check} ${f.item}`) };
  }

  // 04 case judge
  s["04-case-judge"] = judged(verdicts(r, "04"), casesHash(spec), approvalOf(approvals, "04"));

  // 05 execute: every case has an execution result
  const ran = cases.filter((c) => c.execution?.result);
  s["05-execute"] = {
    status: !cases.length || !ran.length ? "pending" : ran.length < cases.length ? "in_progress" : "done",
    executed: ran.length,
    mismatch: ran.filter((c) => c.execution.result === "mismatch").map((c) => c.id),
    blocked: ran.filter((c) => c.execution.result === "blocked").map((c) => c.id),
    has_log: existsSync(join(r, "execution.md")),
  };

  // 06 automate
  const e2e = e2eSpecFor(t);
  s["06-automate"] = { status: e2e ? "done" : "pending", spec: e2e ? relative(ROOT, e2e) : null };

  // 07 test judge
  s["07-test-judge"] = judged(verdicts(r, "07"), e2e ? sha256(readText(e2e)) : null, approvalOf(approvals, "07"));

  // 08 run
  const res = readJson(join(r, "results.json"));
  if (!res) s["08-run"] = { status: "pending" };
  else {
    const st = res.stats ?? {};
    s["08-run"] = {
      status: (st.unexpected ?? 1) === 0 ? "pass" : "fail",
      expected: st.expected ?? 0, unexpected: st.unexpected ?? 0, flaky: st.flaky ?? 0, skipped: st.skipped ?? 0,
      stale: e2e ? res.spec_hash !== sha256(readText(e2e)) : true,
    };
  }

  // 09 triage: needed when a case mismatched or a test failed
  const triage = existsSync(r) ? readdirSync(r).filter((f) => /^triage-\d+\.md$/.test(f)).sort() : [];
  const needed = s["05-execute"].mismatch.length > 0 || s["08-run"].status === "fail";
  s["09-triage"] = {
    status: !needed ? "not_needed" : triage.length ? "done" : "pending",
    files: triage,
    approval: approvalOf(approvals, "09"),
  };

  // 10 report
  s["10-report"] = { status: existsSync(join(r, "report.md")) ? "done" : "pending", approval: approvalOf(approvals, "10") };

  return { run: t, built_at: new Date().toISOString(), agents_sha: agentsSha(), steps: s, next: nextAction(t, s) };
}

function nextAction(t, s) {
  const skill = (name) => ({ who: "agent", cmd: `claude "/${name} ${t}"` });
  const agent = (name) => ({ who: "agent", cmd: `claude "Use the ${name} agent on ${t}"` });
  const human = (what, step) => ({ who: "human", cmd: step ? `agentic-workflows/functional-testing/scripts/approve.sh ${t} ${step}` : null, what });

  const r1 = s["01-requirements"];
  if (r1.status !== "done") return skill("ft-requirements");
  if (r1.open_questions.length) return human(`answer ${r1.open_questions.join(", ")} in runs/${t}/spec.yaml (answer + answered_by)`);
  if (!r1.approval) return human("review spec.yaml and approve the requirements", "01");
  if (s["02-plan"].status !== "done") return skill("ft-plan");
  if (!s["02-plan"].approval) return human("review plan.md and approve it", "02");
  if (s["03-cases"].status !== "done") return skill("ft-cases");

  const j4 = s["04-case-judge"];
  if (j4.status === "pending" || j4.status === "stale") return agent("case-judge");
  if (j4.status === "fail") return { ...skill("ft-cases"), why: `fix the FAIL checks in verdicts/${j4.file} (retry ${j4.retries} of ${MAX_RETRIES})` };
  if (j4.status === "unsure") return human(`decide the UNSURE checks in verdicts/${j4.file}`, "04");
  if (j4.status === "blocked") return human(`case judge failed ${j4.retries} times; fix the cases by hand or approve`, "04");

  if (s["05-execute"].status !== "done") return skill("ft-execute");
  if (s["06-automate"].status !== "done") return skill("ft-automate");

  const j7 = s["07-test-judge"];
  if (j7.status === "pending" || j7.status === "stale") return agent("test-judge");
  if (j7.status === "fail") return { ...skill("ft-automate"), why: `fix the FAIL checks in verdicts/${j7.file} (retry ${j7.retries} of ${MAX_RETRIES})` };
  if (j7.status === "unsure") return human(`decide the UNSURE checks in verdicts/${j7.file}`, "07");
  if (j7.status === "blocked") return human(`test judge failed ${j7.retries} times; fix the spec by hand or approve`, "07");

  if (s["08-run"].status === "pending" || s["08-run"].stale) return { who: "script", cmd: `agentic-workflows/functional-testing/scripts/run-tests.sh ${t}` };
  if (s["09-triage"].status === "pending") return skill("ft-triage");
  if (s["09-triage"].status === "done" && !s["09-triage"].approval) return human("review the bug draft in the triage file; approve to let the agent file it", "09");
  if (s["10-report"].status !== "done") return skill("ft-report");
  if (!s["10-report"].approval) return human("review report.md and approve the Qase push", "10");
  return { who: "agent", cmd: `claude "/ft-report ${t} push"`, what: "push the approved report to Qase (skip if already pushed)" };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t = ticketArg();
  if (!existsSync(runDir(t))) {
    console.error(`no run yet: ${relative(ROOT, runDir(t))} (step 01 creates it)`);
  }
  const state = buildState(t);
  if (existsSync(runDir(t))) writeFileSync(join(runDir(t), "state.json"), JSON.stringify(state, null, 2) + "\n");
  if (!process.argv.includes("--quiet")) console.log(JSON.stringify(state, null, 2));
}
