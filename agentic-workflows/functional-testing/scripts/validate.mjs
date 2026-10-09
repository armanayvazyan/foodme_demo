#!/usr/bin/env node
// Deterministic checks on runs/<T>/spec.yaml.
//   node validate.mjs <T>                    requirements + test cases + coverage
//   node validate.mjs <T> --requirements     requirements only (step 01)
//   node validate.mjs <T> --require-answers  also fail on unanswered questions
//   node validate.mjs <T> --json             machine-readable output
// Exit 0 = all checks pass, 1 = at least one FAIL, 2 = usage / missing file.
import { pathToFileURL } from "node:url";
import { CASE_STATUS, EXEC_RESULT, loadSpec, specPath, ticketArg } from "./lib.mjs";

const AC_ID = /^AC-\d+$/;
const Q_ID = /^Q-\d+$/;
const SOURCE = /^(AC|Q)-\d+$/;

const nonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const list = (v) => (Array.isArray(v) ? v : []);

export function validate(t, spec, { requirementsOnly = false, requireAnswers = false } = {}) {
  const fails = [];
  const warns = [];
  const fail = (check, item, msg) => fails.push({ check, item, msg });

  if (spec?.ticket !== t) fail("V1", "ticket", `ticket is ${JSON.stringify(spec?.ticket)}, expected ${t}`);

  const acs = list(spec?.acs);
  if (acs.length === 0) fail("V2", "acs", "no acceptance criteria");
  const acIds = new Set();
  for (const ac of acs) {
    if (!AC_ID.test(ac?.id ?? "")) fail("V2", ac?.id ?? "?", "AC id must look like AC-<n>");
    else if (acIds.has(ac.id)) fail("V2", ac.id, "duplicate AC id");
    acIds.add(ac?.id);
    if (!nonEmpty(ac?.text)) fail("V2", ac?.id ?? "?", "AC text is empty");
    if (!nonEmpty(ac?.source)) fail("V2", ac?.id ?? "?", "AC has no source (ticket key or doc path)");
  }

  if (!Array.isArray(spec?.out_of_scope)) fail("V3", "out_of_scope", "out_of_scope must be a list (may be empty)");

  const qs = new Map();
  for (const q of list(spec?.questions)) {
    if (!Q_ID.test(q?.id ?? "")) fail("V4", q?.id ?? "?", "question id must look like Q-<n>");
    else if (qs.has(q.id)) fail("V4", q.id, "duplicate question id");
    qs.set(q?.id, q);
    if (!nonEmpty(q?.text)) fail("V4", q?.id ?? "?", "question text is empty");
    for (const a of list(q?.about)) if (!acIds.has(a)) fail("V4", q.id, `about ${a} is not an AC`);
    if (!nonEmpty(q?.answer)) (requireAnswers ? fail : (c, i, m) => warns.push({ check: c, item: i, msg: m }))("V4", q?.id ?? "?", "question has no answer yet");
  }
  const answered = (id) => nonEmpty(qs.get(id)?.answer);

  const coverage = new Map([...acIds].map((id) => [id, []]));
  if (!requirementsOnly) {
    const cases = list(spec?.test_cases);
    if (cases.length === 0) fail("V5", "test_cases", "no test cases");
    const idRe = new RegExp(`^${t}-TC-\\d{2}$`);
    const seen = new Set();
    for (const c of cases) {
      const id = c?.id ?? "?";
      if (!idRe.test(id)) fail("V5", id, `case id must look like ${t}-TC-nn`);
      else if (seen.has(id)) fail("V5", id, "duplicate case id");
      seen.add(id);
      if (!nonEmpty(c?.title)) fail("V5", id, "title is empty");

      const covers = list(c?.covers);
      if (covers.length === 0) fail("V6", id, "covers is empty");
      for (const a of covers) {
        if (!acIds.has(a)) fail("V6", id, `covers ${a}, which is not an AC`);
        else coverage.get(a).push(id);
      }

      for (const q of list(c?.blocked_by)) {
        if (!qs.has(q)) fail("V7", id, `blocked_by ${q}, which is not a question`);
        else if (!answered(q)) warns.push({ check: "V7", item: id, msg: `blocked by unanswered ${q}` });
      }

      if (list(c?.steps).length === 0) fail("V8", id, "steps is empty");
      if (!nonEmpty(c?.expected)) fail("V8", id, "expected is empty");

      const src = c?.expected_source;
      if (!SOURCE.test(src ?? "")) fail("V9", id, `expected_source must be AC-n or Q-n, got ${JSON.stringify(src)}`);
      else if (src.startsWith("AC-") && !acIds.has(src)) fail("V9", id, `expected_source ${src} is not an AC`);
      else if (src.startsWith("Q-") && !qs.has(src)) fail("V9", id, `expected_source ${src} is not a question`);
      else if (src.startsWith("Q-") && !answered(src)) fail("V9", id, `expected_source ${src} has no answer yet`);

      const st = c?.status;
      if (!CASE_STATUS.includes(st)) fail("V10", id, `status must be one of ${CASE_STATUS.join("|")}`);
      const ran = CASE_STATUS.indexOf(st) >= CASE_STATUS.indexOf("executed");
      const ex = c?.execution;
      if (ran && !EXEC_RESULT.includes(ex?.result)) fail("V10", id, `status ${st} needs execution.result ${EXEC_RESULT.join("|")}`);
      if (ex != null && !ran) fail("V10", id, `has execution but status is ${st}`);
      if (ex != null && !nonEmpty(ex?.log)) fail("V10", id, "execution.log is empty");
      if (CASE_STATUS.indexOf(st) >= CASE_STATUS.indexOf("automated") && !nonEmpty(c?.spec)) fail("V10", id, `status ${st} needs spec (the Playwright test title)`);
    }
    for (const [ac, ids] of coverage) if (ids.length === 0) fail("V11", ac, "not covered by any case");
  }

  return { ok: fails.length === 0, fails, warns, coverage: Object.fromEntries(coverage) };
}

function print(t, r, requirementsOnly) {
  for (const f of r.fails) console.log(`FAIL ${f.check} ${f.item}: ${f.msg}`);
  for (const w of r.warns) console.log(`warn ${w.check} ${w.item}: ${w.msg}`);
  if (!requirementsOnly) {
    console.log("\n| AC | Cases |\n|---|---|");
    for (const [ac, ids] of Object.entries(r.coverage)) console.log(`| ${ac} | ${ids.length ? ids.join(", ") : "**none**"} |`);
  }
  console.log(`\n${t}: ${r.ok ? "valid" : `${r.fails.length} FAIL`}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t = ticketArg();
  const flags = new Set(process.argv.slice(3));
  let spec;
  try {
    spec = loadSpec(t);
  } catch (e) {
    console.error(`FAIL V0 spec.yaml: not valid YAML: ${e.message}`);
    process.exit(1);
  }
  if (!spec) {
    console.error(`missing ${specPath(t)}`);
    process.exit(2);
  }
  const opts = { requirementsOnly: flags.has("--requirements"), requireAnswers: flags.has("--require-answers") };
  const r = validate(t, spec, opts);
  if (flags.has("--json")) console.log(JSON.stringify(r, null, 2));
  else print(t, r, opts.requirementsOnly);
  process.exit(r.ok ? 0 : 1);
}
