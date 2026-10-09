#!/usr/bin/env node
// Called by approve.sh only. Asks the human about each FAIL / UNSURE check of a verdict
// and writes the answer (agreed | overridden) into runs/findings.jsonl.
//   node decide.mjs <T> <verdict.json> <findings.jsonl>   (stdin = the terminal)
import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createInterface } from "node:readline/promises";
import { readJson, readJsonl } from "./lib.mjs";

const [, , t, verdictFile, findingsFile] = process.argv;
const v = readJson(verdictFile);
const name = basename(verdictFile);
const rows = readJsonl(findingsFile);
const rl = createInterface({ input: process.stdin, output: process.stdout });

for (const c of v.checks.filter((c) => c.result !== "PASS")) {
  console.log(`\n${c.result} ${c.check} ${c.item}\n  reason: ${c.reason}`);
  if (c.case_quote) console.log(`  case:   "${c.case_quote}"`);
  if (c.source_quote) console.log(`  source: "${c.source_quote}"`);
  let a = "";
  while (!["a", "o"].includes(a)) a = (await rl.question("  [a]gree / [o]verride? ")).trim().toLowerCase();
  const human = a === "a" ? "agreed" : "overridden";
  const row = rows.find((f) => f.run === t && f.verdict === name && f.check === c.check && f.item === c.item);
  if (row) row.human = human;
}
rl.close();
writeFileSync(findingsFile, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
