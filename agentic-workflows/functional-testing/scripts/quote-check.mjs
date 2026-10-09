#!/usr/bin/env node
// Verifies triage evidence word for word against the raw sources in runs/<T>/raw/.
//   node quote-check.mjs <T> runs/<T>/evidence/<collector>.json   each quote is in its source
//   node quote-check.mjs <T> runs/<T>/triage-<k>.md               each claim cites verified quotes
// Exit 0 = all verified, 1 = something is not.
import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { readJson, readText, runDir, ticketArg } from "./lib.mjs";

// Whitespace, markdown bold and curly quotes don't count as differences.
export const norm = (s) =>
  String(s ?? "").replace(/\*\*/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

// Source id -> raw file. Collectors may only cite these ids.
export function sourceFile(t, id) {
  const r = runDir(t);
  if (id === "execution") return join(r, "execution.md");
  if (id === "results") return join(r, "results.json");
  if (!/^[a-z0-9-]+$/.test(id ?? "")) return null;
  const raw = join(r, "raw");
  if (!existsSync(raw)) return null;
  const hit = readdirSync(raw).find((f) => f.replace(/\.[^.]+$/, "") === id && !f.endsWith(".json"));
  return hit ? join(raw, hit) : existsSync(join(raw, `${id}.json`)) ? join(raw, `${id}.json`) : null;
}

// One quote: { id, source, ts, quote }. Line-based sources (*.log) start each entry with its ISO timestamp.
export function checkQuote(t, q) {
  if (!q?.id || !q?.quote) return "missing id or quote";
  if (!q.ts) return "missing ts";
  const file = sourceFile(t, q.source);
  if (!file) return `unknown source ${JSON.stringify(q.source)}`;
  const text = readText(file);
  const needle = norm(q.quote);
  if (needle.length < 8) return "quote too short to verify (min 8 chars)";
  if (!file.endsWith(".log")) return norm(text).includes(needle) ? null : `not found in ${basename(file)}`;
  // A log entry can span lines (bodies, stack traces): split on lines that start with a timestamp.
  const entries = text.split(/\n(?=\d{4}-\d{2}-\d{2}T)/);
  const hits = entries.filter((e) => norm(e).includes(needle));
  if (!hits.length) return `not found in ${basename(file)}`;
  const ts = String(q.ts).slice(0, 19);
  return hits.some((e) => e.startsWith(ts)) ? null : `found, but not in an entry at ${q.ts}`;
}

export function checkEvidence(t, ev) {
  if (ev?.run !== t) return [{ id: "run", error: `run is ${JSON.stringify(ev?.run)}, expected ${t}` }];
  return (ev.quotes ?? []).map((q) => ({ id: q?.id, error: checkQuote(t, q) }));
}

// All verified quotes of the run, by id.
export function verifiedQuotes(t) {
  const dir = join(runDir(t), "evidence");
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    for (const q of readJson(join(dir, f)).quotes ?? []) if (!checkQuote(t, q)) out.set(q.id, q);
  }
  return out;
}

// Triage file: every "- H-n: claim [E-1, E-2]" line cites at least one verified quote.
export function checkTriage(t, md) {
  const ok = verifiedQuotes(t);
  const claims = md.split("\n").filter((l) => /^\s*-\s*H-\d+:/.test(l));
  if (!claims.length) return [{ id: "triage", error: "no hypothesis lines (- H-n: claim [E-n])" }];
  return claims.map((l) => {
    const id = l.match(/H-\d+/)[0];
    const cited = [...l.matchAll(/E-\d+/g)].map((m) => m[0]);
    if (!cited.length) return { id, error: "cites no evidence" };
    const bad = cited.filter((e) => !ok.has(e));
    return { id, error: bad.length ? `cites unverified or unknown ${bad.join(", ")}` : null };
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t = ticketArg();
  const file = process.argv[3];
  if (!file || !existsSync(file)) {
    console.error("usage: quote-check.mjs <T> <evidence.json | triage-k.md>");
    process.exit(2);
  }
  const res = file.endsWith(".md") ? checkTriage(t, readText(file)) : checkEvidence(t, readJson(file));
  for (const r of res) console.log(`${r.error ? "FAIL" : "ok  "} ${r.id}${r.error ? `: ${r.error}` : ""}`);
  const bad = res.filter((r) => r.error).length;
  console.log(`${basename(file)}: ${bad ? `${bad} FAIL` : "all verified"}`);
  process.exit(bad ? 1 : 0);
}
