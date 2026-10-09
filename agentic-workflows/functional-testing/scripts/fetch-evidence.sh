#!/usr/bin/env bash
# Saves raw triage evidence into runs/<T>/raw/ so quotes can be checked word for word.
#   fetch-evidence.sh <T> <from ISO> <to ISO> [line filter]
#   fetch-evidence.sh KAN-27 2026-10-09T07:00:00Z 2026-10-09T08:00:00Z "/api/customer/promo"
# Writes loki.json + loki.log (one entry per log line, ISO timestamp first) and
# glitchtip.json + glitchtip.log (one entry per issue, last seen first). Needs no LLM.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
t="${1:?usage: fetch-evidence.sh <T> <from> <to> [filter]}"
from="${2:?from}"; to="${3:?to}"; filter="${4:-}"
raw="$here/../runs/$t/raw"
mkdir -p "$raw"
loki="${FT_LOKI_URL:-https://foodme-monitoring.onrender.com/loki}"
gt="${FT_GLITCHTIP_URL:-https://app.glitchtip.com}"
gt_org="${FT_GLITCHTIP_ORG:-foodme}"

query='{app="foodme-backend"}'
[ -n "$filter" ] && query="$query |= \"$filter\""
curl -sS -f -m 90 -G "$loki/api/v1/query_range" \
  --data-urlencode "query=$query" --data-urlencode "start=$from" --data-urlencode "end=$to" \
  --data-urlencode "limit=1000" --data-urlencode "direction=forward" -o "$raw/loki.json"
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const [src, dst] = process.argv.slice(1);
const rows = JSON.parse(readFileSync(src, "utf8")).data.result.flatMap((s) => s.values);
rows.sort((a, b) => (BigInt(a[0]) < BigInt(b[0]) ? -1 : 1));
const out = rows.map(([ns, line]) => {
  const ts = new Date(Number(BigInt(ns) / 1000000n)).toISOString();
  let e; try { e = JSON.parse(line); } catch { return `${ts} ${line}`; }
  return `${ts} ${e.level ?? ""} ${e.logger_name ?? ""} - ${e.message ?? line}${e.stack_trace ? "\n" + e.stack_trace : ""}`;
});
writeFileSync(dst, out.join("\n") + "\n");
console.log(`loki: ${out.length} entries`);
' "$raw/loki.json" "$raw/loki.log"

# GlitchTip: through agentsecrets so the token never enters this shell.
# agentsecrets finds its project from the working directory, so call it from the repo root.
if (cd "$root" && agentsecrets call --url "$gt/api/0/organizations/$gt_org/issues/?limit=100" --bearer GLITCHTIP_TOKEN) >"$raw/glitchtip.json" 2>"$raw/glitchtip.err" \
   && node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$raw/glitchtip.json" 2>/dev/null; then
  node --input-type=module -e '
  import { readFileSync, writeFileSync } from "node:fs";
  const [src, dst, from, to] = process.argv.slice(1);
  const issues = JSON.parse(readFileSync(src, "utf8"))
    .filter((i) => i.lastSeen >= from && i.firstSeen <= to)
    .sort((a, b) => (a.lastSeen < b.lastSeen ? -1 : 1));
  const out = issues.map((i) => `${new Date(i.lastSeen).toISOString()} [${i.shortId ?? i.id}] ${i.level} ${i.title} | culprit=${i.culprit ?? ""} | count=${i.count} | firstSeen=${i.firstSeen}`);
  writeFileSync(dst, out.join("\n") + "\n");
  console.log(`glitchtip: ${out.length} issues seen in the window`);
  ' "$raw/glitchtip.json" "$raw/glitchtip.log" "$from" "$to"
  rm -f "$raw/glitchtip.err"
else
  echo "glitchtip: unavailable: $(cat "$raw/glitchtip.err" "$raw/glitchtip.json" 2>/dev/null | head -c 300)" >&2
  rm -f "$raw/glitchtip.json" "$raw/glitchtip.log" "$raw/glitchtip.err"
fi
