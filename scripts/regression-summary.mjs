#!/usr/bin/env node
// Builds test-results/regression/summary.md from the per-suite reports regression.sh produced.
// Usage: node scripts/regression-summary.mjs <outDir>
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2];
const read = (f) => {
  try {
    return fs.readFileSync(path.join(out, f), "utf8");
  } catch {
    return null;
  }
};
const status = (read("status.tsv") || "")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("\t"));

const rows = [];
const failures = [];

for (const [suite, code, secs] of status) {
  const r = { suite, passed: 0, failed: 0, skipped: 0, flaky: 0, expectedFail: 0, secs, code };

  if (suite === "backend") {
    const dir = path.join(out, "backend-junit");
    for (const f of fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((x) => x.endsWith(".xml"))
      : []) {
      const xml = fs.readFileSync(path.join(dir, f), "utf8");
      for (const m of xml.matchAll(
        /<testcase name="([^"]+)" classname="([^"]+)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g,
      )) {
        const body = m[4] || "";
        if (/<failure|<error/.test(body)) {
          r.failed++;
          const msg = body.match(/message="([^"]*)"/)?.[1] || "";
          failures.push({
            suite,
            test: `${m[2].split(".").pop()} > ${m[1]}`,
            where: m[2],
            error: msg.slice(0, 300),
          });
        } else if (/<skipped/.test(body)) r.skipped++;
        else r.passed++;
      }
    }
  }

  if (suite === "web-unit") {
    const j = JSON.parse(read("web-unit.json") || "{}");
    for (const file of j.testResults || []) {
      for (const t of file.assertionResults || []) {
        if (t.status === "passed") r.passed++;
        else if (t.status === "failed") {
          r.failed++;
          failures.push({
            suite,
            test: t.fullName,
            where: path.relative(process.cwd(), file.name),
            error: (t.failureMessages || []).join(" ").split("\n")[0].slice(0, 300),
          });
        } else r.skipped++;
      }
    }
    // vitest reports it.fails() that fail as "passed"; surface the count from the log.
    r.expectedFail = Number((read("web-unit.log") || "").match(/(\d+) expected fail/)?.[1] || 0);
    r.passed -= r.expectedFail;
  }

  if (suite.endsWith("-e2e") && code !== "skipped") {
    const j = JSON.parse(read(`${suite}.json`) || "{}");
    const walk = (s, trail) => {
      for (const spec of s.specs || []) {
        for (const t of spec.tests || []) {
          const outcome = t.status; // expected | unexpected | flaky | skipped
          if (outcome === "expected") r.passed++;
          else if (outcome === "flaky") r.flaky++;
          else if (outcome === "skipped") r.skipped++;
          else {
            r.failed++;
            const res = (t.results || []).at(-1) || {};
            failures.push({
              suite,
              test: [...trail, spec.title].filter(Boolean).join(" › "),
              where: `${spec.file}:${spec.line}`,
              error: String(res.error?.message || "")
                .replace(/\x1b\[[0-9;]*m/g, "")
                .split("\n")
                .slice(0, 2)
                .join(" ")
                .slice(0, 300),
            });
          }
        }
      }
      for (const child of s.suites || [])
        walk(child, [...trail, child.title.endsWith(".ts") ? "" : child.title]);
    };
    for (const s of j.suites || []) walk(s, []);
  }
  rows.push(r);
}

const icon = (r) => (r.code === "skipped" ? "⏭️ skipped" : r.code === "0" ? "✅ pass" : "❌ fail");
const lines = [
  `# Regression summary — ${new Date().toISOString()}`,
  "",
  "| Suite | Result | Passed | Failed | Flaky | Skipped | Known-bug (expected fail) | Time |",
  "|---|---|---:|---:|---:|---:|---:|---:|",
  ...rows.map(
    (r) =>
      `| ${r.suite} | ${icon(r)} | ${r.passed} | ${r.failed} | ${r.flaky} | ${r.skipped} | ${r.expectedFail} | ${r.secs}s |`,
  ),
  "",
];
if (failures.length) {
  lines.push("## Failures", "");
  for (const f of failures)
    lines.push(`- **[${f.suite}] ${f.test}** — \`${f.where}\`  `, `  ${f.error || "(see log)"}`);
  lines.push("");
}
if (rows.some((r) => r.flaky))
  lines.push(
    "Flaky = failed first, passed on retry. Treat as a bug in the test or app, not as green.",
    "",
  );
lines.push(`Logs and reports: \`${path.relative(process.cwd(), out) || out}/\``);
console.log(lines.join("\n"));
