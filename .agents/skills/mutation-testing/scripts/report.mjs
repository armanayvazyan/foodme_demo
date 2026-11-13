#!/usr/bin/env node
// Builds and checks the mutation-testing report. The agent records *what* it mutated in
// mutants.json. Statuses come only from the harness results written by run-tests.sh,
// and the counts, score and pass/fail are always recomputed here.
//
//   node report.mjs finalize --dir <MUTATION_DIR> --sha <sha> --pr <n> --threshold <pct> --scope <scope.txt>
//       writes <dir>/mutation-report.json and <dir>/mutation-report.md
//   node report.mjs gate --report <mutation-report.json> --sha <sha> --threshold <pct>
//       exits 0 on pass, 1 on fail; prints a one-line reason (fits a commit status)
import fs from "node:fs";
import path from "node:path";

const STATUSES = ["killed", "survived", "timeout", "invalid", "unverified"];
const MODULES = ["backend", "web", "admin"];

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1];
  return out;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

// Killed and timed-out mutants are caught by the tests. Survived and unverified ones aren't.
// Invalid mutants (don't compile, edit tests) are listed but never scored.
export function summarize(mutants, threshold, scope) {
  const count = (list, ...st) => list.filter((m) => st.includes(m.status)).length;
  const tally = (list) => {
    const killed = count(list, "killed", "timeout");
    const survived = count(list, "survived", "unverified");
    const mutations = killed + survived;
    const score = mutations ? Math.round((killed / mutations) * 1000) / 10 : null;
    return { mutations, killed, survived, score };
  };
  const total = tally(mutants);
  let result = "pass";
  let reason;
  if (total.mutations === 0) {
    result = scope.length ? "fail" : "pass";
    reason = scope.length ? "No mutants were run against the changed code" : "No mutable production code changed";
  } else {
    result = total.score >= threshold ? "pass" : "fail";
    reason = `Mutation score ${total.score}% (threshold ${threshold}%)`;
  }
  const modules = {};
  for (const m of MODULES) {
    const list = mutants.filter((x) => x.module === m);
    if (list.length) modules[m] = tally(list);
  }
  return { summary: { ...total, result }, modules, invalid: count(mutants, "invalid"), reason };
}

function finalize(o) {
  const dir = o.dir;
  const threshold = Number(o.threshold);
  const scope = fs.existsSync(o.scope) ? fs.readFileSync(o.scope, "utf8").split("\n").filter(Boolean) : [];
  const agent = readJson(path.join(dir, "mutants.json"), null);
  const notes = Array.isArray(agent?.notes) ? agent.notes.map(String) : [];
  let error = fs.existsSync(path.join(dir, "error.txt")) ? fs.readFileSync(path.join(dir, "error.txt"), "utf8").trim() : null;
  if (!agent && scope.length && !error) error = "The agent did not write mutants.json.";

  // Harness results, keyed by "<module>-<id>". Baselines aren't mutants.
  const resultsDir = path.join(dir, "results");
  const results = new Map();
  for (const f of fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir) : []) {
    const r = readJson(path.join(resultsDir, f), null);
    if (r && r.id !== "baseline") results.set(`${r.module}-${r.id}`, r);
  }

  const mutants = [];
  const seen = new Set();
  for (const m of Array.isArray(agent?.mutants) ? agent.mutants : []) {
    const key = `${m.module}-${m.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = results.get(key);
    mutants.push({
      id: String(m.id),
      module: String(m.module),
      file: String(m.file ?? ""),
      line: Number(m.line) || null,
      category: m.category === "product" ? "product" : "classical",
      operator: String(m.operator ?? ""),
      description: String(m.description ?? ""),
      original: String(m.original ?? ""),
      mutated: String(m.mutated ?? ""),
      status: r ? r.status.toLowerCase() : "unverified",
      killedBy: r?.failedTests ?? [],
      seconds: r?.seconds ?? null,
      patch: r?.patch ?? null,
      note: r ? String(m.note ?? r.reason ?? "") : "No harness result for this mutant: run-tests.sh was not run with this id.",
    });
  }
  // A mutant the harness ran but the agent didn't record still counts.
  for (const [key, r] of results) {
    if (seen.has(key)) continue;
    mutants.push({
      id: r.id, module: r.module, file: "", line: null, category: "classical", operator: "",
      description: "(not recorded by the agent; see the patch)", original: "", mutated: "",
      status: r.status.toLowerCase(), killedBy: r.failedTests ?? [], seconds: r.seconds, patch: r.patch, note: r.reason ?? "",
    });
  }
  mutants.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const s = summarize(mutants, threshold, scope);
  if (error) {
    s.summary.result = "fail";
    s.reason = error;
  }
  const report = {
    schemaVersion: 1,
    sha: o.sha,
    pr: o.pr ? Number(o.pr) : null,
    threshold,
    summary: s.summary,
    modules: s.modules,
    invalid: s.invalid,
    reason: s.reason,
    error,
    scope,
    mutants,
    notes,
  };
  fs.writeFileSync(path.join(dir, "mutation-report.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "mutation-report.md"), render(report));
  console.log(`${report.summary.result.toUpperCase()}: ${report.reason}`);
}

const STATUS_LABEL = {
  killed: "✅ Killed",
  timeout: "✅ Timeout",
  survived: "❌ Survived",
  unverified: "❌ Unverified",
  invalid: "⚪ Invalid",
};

const cell = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const code = (v) => (v ? `\`${cell(v).replace(/`/g, "'")}\`` : "");
const pct = (v) => (v === null || v === undefined ? "n/a" : `${v}%`);

export function render(r) {
  const s = r.summary;
  const pass = s.result === "pass";
  const lines = [
    "## 🧬 Mutation testing",
    "",
    `**Result:** ${pass ? "✅ Passed" : "❌ Failed"}. ${r.reason}.`,
    "",
    "| Mutations | Killed | Survived | Score | Pass/Fail |",
    "|---|---|---|---|---|",
    `| ${s.mutations} | ${s.killed} | ${s.survived} | ${pct(s.score)} | ${pass ? "✅ pass" : "❌ fail"} |`,
    "",
  ];
  if (r.error) lines.push(`> ⚠️ ${cell(r.error)}`, "");

  const mods = Object.entries(r.modules);
  if (mods.length > 1) {
    lines.push("| Module | Mutations | Killed | Survived | Score |", "|---|---|---|---|---|");
    for (const [m, t] of mods) lines.push(`| ${m} | ${t.mutations} | ${t.killed} | ${t.survived} | ${pct(t.score)} |`);
    lines.push("");
  }

  const scored = r.mutants.filter((m) => m.status !== "invalid");
  lines.push(`### Mutants (${scored.length})`, "");
  if (scored.length) {
    lines.push("| # | Status | Module | Location | Type | Mutation | Killed by |", "|---|---|---|---|---|---|---|");
    for (const m of scored) {
      const loc = m.file ? code(`${path.basename(m.file)}${m.line ? `:${m.line}` : ""}`) : "";
      const change = [cell(m.description), m.original || m.mutated ? `${code(m.original)} → ${code(m.mutated)}` : ""]
        .filter(Boolean).join("<br>");
      const by = m.killedBy.length ? m.killedBy.slice(0, 3).map(cell).join("<br>") : m.status === "timeout" ? "timeout" : "—";
      lines.push(`| ${m.id} | ${STATUS_LABEL[m.status]} | ${m.module} | ${loc} | ${m.category} · ${cell(m.operator)} | ${change} | ${by} |`);
    }
  } else {
    lines.push("None.");
  }
  lines.push("");

  const survived = scored.filter((m) => m.status === "survived" || m.status === "unverified");
  if (survived.length) {
    lines.push(`### Survived mutants: tests to add (${survived.length})`, "");
    for (const m of survived) lines.push(`- **${m.id}** ${code(m.file)}: ${cell(m.note) || cell(m.description)}`);
    lines.push("");
  }

  const invalid = r.mutants.filter((m) => m.status === "invalid");
  if (invalid.length) {
    lines.push(`<details><summary>Invalid mutants, not scored (${invalid.length})</summary>`, "");
    for (const m of invalid) lines.push(`- **${m.id}** ${code(m.file)} ${cell(m.description)}: ${cell(m.note)}`);
    lines.push("", "</details>", "");
  }

  if (r.notes.length) {
    lines.push("### Notes", "");
    for (const n of r.notes) lines.push(`- ${cell(n)}`);
    lines.push("");
  }
  lines.push(`<sub>Threshold ${r.threshold}%. Killed and timed-out mutants count as killed; invalid mutants are not scored. Full report: the \`mutation-report\` artifact of this run.</sub>`, "");
  return lines.join("\n");
}

function gate(o) {
  const r = readJson(o.report, null);
  const fail = (msg) => {
    console.log(msg);
    process.exit(1);
  };
  if (!r || !Array.isArray(r.mutants)) fail("No valid mutation report");
  if (o.sha && r.sha !== o.sha) fail("Mutation report is for an older commit");
  if (r.error) fail(String(r.error).slice(0, 120));
  for (const m of r.mutants) if (!STATUSES.includes(m.status)) fail(`Unknown mutant status: ${m.status}`);
  const threshold = Number(o.threshold);
  const s = summarize(r.mutants, threshold, Array.isArray(r.scope) ? r.scope : []);
  const t = s.summary;
  console.log(`${s.reason}: ${t.killed} killed, ${t.survived} survived of ${t.mutations}`);
  process.exit(t.result === "pass" ? 0 : 1);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "finalize") finalize(args(rest));
else if (cmd === "gate") gate(args(rest));
else {
  console.error("usage: report.mjs finalize|gate [--options]");
  process.exit(2);
}
