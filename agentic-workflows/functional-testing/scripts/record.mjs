#!/usr/bin/env node
// SubagentStop hook: turns a read-only subagent's final message into a run file.
//   case-judge  -> runs/<T>/verdicts/04-NN.json  + findings.jsonl
//   test-judge  -> runs/<T>/verdicts/07-NN.json  + findings.jsonl
//   skeptic     -> runs/<T>/verdicts/09-NN.json  + findings.jsonl
//   collector-* -> runs/<T>/evidence/<agent>.json (quotes checked word for word)
// Exit 2 sends the reason back to the subagent once, so it can fix its output.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, VERDICT, CHECK_RESULT, WF, agentsSha, casesHash, e2eSpecFor, loadSpec, readText, runDir, sha256 } from "./lib.mjs";
import { checkEvidence, norm } from "./quote-check.mjs";

const JUDGES = { "case-judge": { step: "04", rubric: "cases.md" }, "test-judge": { step: "07", rubric: "tests.md" }, skeptic: { step: "09", rubric: "triage.md" } };

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.stderr.write("record.mjs: no hook input on stdin\n");
  process.exit(0);
}
const agent = input.agent_type ?? "";
const judge = JUDGES[agent];
if (!judge && !agent.startsWith("collector")) process.exit(0);

function reject(why) {
  if (input.stop_hook_active) {
    process.stderr.write(`record.mjs: ${agent} output not recorded: ${why}\n`);
    process.exit(0);
  }
  process.stderr.write(`Your final message could not be recorded: ${why}\nEnd with exactly one \`\`\`json block in the shape your instructions give, and nothing after it.\n`);
  process.exit(2);
}

// Last ```json block, or the whole message if it is bare JSON.
function lastJson(text) {
  const blocks = [...String(text ?? "").matchAll(/```json\s*\n([\s\S]*?)```/g)];
  const raw = blocks.length ? blocks.at(-1)[1] : text;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return reject(`no valid JSON (${e.message})`);
  }
}

// Model and size of the subagent run, for the dry-run report.
function usage(path) {
  const out = { model: null, turns: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0 };
  for (const l of (readText(path) ?? "").split("\n")) {
    if (!l.includes('"assistant"')) continue;
    try {
      const m = JSON.parse(l).message;
      if (!m?.usage) continue;
      out.model = m.model ?? out.model;
      out.turns += 1;
      out.input_tokens += (m.usage.input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0);
      out.output_tokens += m.usage.output_tokens ?? 0;
      out.cache_read_tokens += m.usage.cache_read_input_tokens ?? 0;
    } catch {}
  }
  return out;
}

const nextFile = (dir, prefix, ext) => {
  mkdirSync(dir, { recursive: true });
  const n = readdirSync(dir).filter((f) => f.startsWith(prefix)).length + 1;
  return join(dir, `${prefix}${String(n).padStart(2, "0")}${ext}`);
};

const out = lastJson(input.last_assistant_message);
const t = out?.run;
if (!/^[A-Z]+-\d+$/.test(t ?? "") || !existsSync(runDir(t))) reject(`"run" must be the ticket of an existing run, got ${JSON.stringify(t)}`);
const r = runDir(t);
const meta = { agent, agent_id: input.agent_id, recorded_at: new Date().toISOString(), agents_sha: agentsSha(), ...usage(input.agent_transcript_path) };

if (!judge) {
  // Collector: quotes only. Every quote must be word for word in its raw source.
  if (!Array.isArray(out.quotes) || !out.quotes.length) reject('"quotes" must be a non-empty list');
  const bad = checkEvidence(t, out).filter((x) => x.error);
  if (bad.length && !input.stop_hook_active) reject(`these quotes are not word for word in their source: ${bad.map((b) => `${b.id} (${b.error})`).join("; ")}. Copy them exactly, or drop them.`);
  mkdirSync(join(r, "evidence"), { recursive: true });
  writeFileSync(join(r, "evidence", `${agent}.json`), JSON.stringify({ ...out, ...meta, unverified: bad.map((b) => b.id) }, null, 2) + "\n");
  process.exit(0);
}

// Judge verdict.
if (out.step !== judge.step) reject(`"step" must be "${judge.step}"`);
if (!VERDICT.includes(out.verdict)) reject(`"verdict" must be one of ${VERDICT.join("|")}`);
if (!Array.isArray(out.checks) || !out.checks.length) reject('"checks" must be a non-empty list');

const rubric = readText(join(WF, "rubrics", judge.rubric));
const category = Object.fromEntries([...rubric.matchAll(/^\| ([A-Z]\d+) \| `([a-z-]+)` \|/gm)].map((m) => [m[1], m[2]]));

// What the quotes may come from, per step.
const spec = loadSpec(t);
const e2e = e2eSpecFor(t);
const specText = readText(join(r, "spec.yaml")) ?? "";
const docText = spec?.sources?.doc ? readText(join(ROOT, spec.sources.doc)) ?? "" : "";
const triageText = readdirSync(r).filter((f) => /^triage-\d+\.md$/.test(f)).map((f) => readText(join(r, f))).join("\n");
const evidenceText = existsSync(join(r, "evidence")) ? readdirSync(join(r, "evidence")).map((f) => readText(join(r, "evidence", f))).join("\n") : "";
const hay = {
  "04": { case: specText, source: specText + docText },
  "07": { case: readText(e2e ?? "") ?? "", source: specText + readText(join(ROOT, ".agents/skills/test-review/SKILL.md")) + rubric },
  "09": { case: triageText, source: evidenceText + triageText },
}[judge.step];
// spec.yaml may wrap or escape long strings: compare against both the file and its parsed strings.
const strings = (v) => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);
const parsed = strings(spec).join("\n");
const found = (q, h) => !q || norm(h + "\n" + parsed).includes(norm(q)) || norm(h).replace(/\\"/g, '"').includes(norm(q));

const problems = [];
let worst = "PASS";
for (const c of out.checks) {
  if (!category[c?.check]) problems.push(`check ${JSON.stringify(c?.check)} is not in rubrics/${judge.rubric}`);
  if (!CHECK_RESULT.includes(c?.result)) problems.push(`${c?.check} ${c?.item}: result must be PASS|FAIL|UNSURE`);
  if (!c?.item) problems.push(`${c?.check}: item is empty`);
  if (c?.result === "FAIL" && !(c.case_quote || c.source_quote)) problems.push(`${c.check} ${c.item}: FAIL needs a quote`);
  if (c?.result !== "PASS" && !c?.reason) problems.push(`${c?.check} ${c?.item}: ${c?.result} needs a reason`);
  c.quotes_verified = found(c?.case_quote, hay.case) && found(c?.source_quote, hay.source);
  if (c?.result === "FAIL" && !c.quotes_verified) problems.push(`${c.check} ${c.item}: a quote is not word for word in the files`);
  if (c?.result === "FAIL") worst = "FAIL";
  else if (c?.result === "UNSURE" && worst !== "FAIL") worst = "UNSURE";
}
if (problems.length) reject(problems.join("; "));
const expected = { PASS: "pass", FAIL: "fail", UNSURE: "unsure" }[worst];
if (out.verdict !== expected) reject(`"verdict" is ${out.verdict} but the checks give ${expected}`);

const inputHash = judge.step === "04" ? casesHash(spec) : judge.step === "07" ? sha256(readText(e2e ?? "") ?? "") : sha256(triageText);
const file = nextFile(join(r, "verdicts"), `${judge.step}-`, ".json");
const name = file.split("/").at(-1);
writeFileSync(file, JSON.stringify({ run: t, step: out.step, verdict: out.verdict, checks: out.checks, input_hash: inputHash, ...meta }, null, 2) + "\n");

for (const c of out.checks.filter((c) => c.result !== "PASS")) {
  appendFileSync(join(WF, "runs", "findings.jsonl"), JSON.stringify({
    run: t, step: judge.step, by: agent, check: c.check, category: category[c.check], item: c.item,
    evidence: c.case_quote || c.source_quote || c.reason, skill_sha: meta.agents_sha, human: null, verdict: name,
  }) + "\n");
}
