#!/usr/bin/env bash
# Step 05 setup, run by a human or CI before /ft-execute. Needs no LLM.
#   session.sh <T>
# Registers a throwaway customer (ft-<time>@example.com) on the SUT in spec.yaml, then writes
#   runs/<T>/.auth/customer.json  Playwright storage state, signed in (localStorage foodme.customer.auth)
#   runs/<T>/.auth/mcp.json       --mcp-config for a headless, isolated Playwright MCP limited to the SUT
# The agent never types a password or creates an account; it starts already signed in.
# .auth/ is gitignored and script-only (guard.mjs). Re-run it when the token expires.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
t="${1:?usage: session.sh <T>}"
run="$here/../runs/$t"
[ -f "$run/spec.yaml" ] || { echo "no $run/spec.yaml: run step 01 first" >&2; exit 2; }

sut="$(cd "$here" && node --input-type=module -e '
import { loadSpec } from "./lib.mjs";
const u = new URL(loadSpec(process.argv[1])?.sut ?? "");
process.stdout.write(u.origin);' "$t")"
[ -n "$sut" ] || { echo "spec.yaml has no sut URL" >&2; exit 2; }

auth="$run/.auth"
mkdir -p "$auth"
chmod 700 "$auth"
email="ft-$(date +%s)-$RANDOM@example.com"
password="ft-$(openssl rand -hex 12)"
body="$(printf '{"fullName":"FT Customer","email":"%s","phoneNumber":"+37490000000","password":"%s"}' "$email" "$password")"

# The free tier sleeps: the first call can take a minute.
curl -sS -f -m 120 -H "Content-Type: application/json" -d "$body" "$sut/api/auth/register" -o "$auth/register.json"

(umask 077; node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const [dir, origin, wf] = process.argv.slice(1);
const auth = JSON.parse(readFileSync(`${dir}/register.json`, "utf8"));
if (!auth?.token || !auth?.customer?.email) { console.error("register response has no token/customer"); process.exit(1); }
writeFileSync(`${dir}/customer.json`, JSON.stringify({
  cookies: [],
  origins: [{ origin, localStorage: [{ name: "foodme.customer.auth", value: JSON.stringify(auth) }] }],
}, null, 2) + "\n");
const run = dir.replace(/\/\.auth$/, "");
writeFileSync(`${dir}/mcp.json`, JSON.stringify({
  mcpServers: {
    playwright: {
      command: "npx",
      args: ["-y", "@playwright/mcp@0.0.82", "--headless", "--isolated",
        "--storage-state", `${dir}/customer.json`, "--output-dir", `${run}/browser`,
        "--allowed-origins", origin, "--block-service-workers", "--viewport-size", "1280,900"],
    },
  },
}, null, 2) + "\n");
console.log(`signed in as ${auth.customer.email} on ${origin}`);
' "$(cd "$auth" && pwd)" "$sut" "$here/..")
rm -f "$auth/register.json"
echo "next: claude --mcp-config agentic-workflows/functional-testing/runs/$t/.auth/mcp.json \"/ft-execute $t\""
