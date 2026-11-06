#!/usr/bin/env node
// PreToolUse hook (Write|Edit): blocks test changes that
//   1. add a fixed sleep (page.waitForTimeout, setTimeout, Thread.sleep, TimeUnit.X.sleep)
//   2. add a focused/skipped test (.only / .skip / .fixme, @Disabled / @Ignore)
//   3. leave a test file with no assertions at all
// Only patterns *added* by the edit count, so pre-existing code never blocks an unrelated edit.
// apps/web/e2e/flake-*.spec.ts are intentionally flaky teaching examples and are exempt.
import { readFileSync, existsSync } from 'node:fs';

const allow = () => process.exit(0);
const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
};

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  allow();
}

const { tool_name: tool, tool_input: ti = {} } = input;
const filePath = ti.file_path;
if (!filePath || (tool !== 'Write' && tool !== 'Edit')) allow();

const p = filePath.replace(/\\/g, '/');
const isTs = /\/apps\/(web|admin)\/(?!.*node_modules\/).*\.(spec|test)\.[cm]?[jt]sx?$/.test(p);
const isJava = /\/apps\/backend\/src\/test\/.*(Test|Tests|IT)\.java$/.test(p);
if (!isTs && !isJava) allow();
if (/\/apps\/web\/e2e\/flake-[^/]*\.spec\.ts$/.test(p)) allow();

const RULES = isTs
  ? [
      { re: /\.waitForTimeout\s*\(/g, msg: 'fixed sleep page.waitForTimeout() — use a web-first assertion such as await expect(locator).toBeVisible() instead' },
      { re: /\bsetTimeout\s*\(/g, msg: 'fixed sleep via setTimeout() — wait for UI/API state with expect(...) or page.waitForResponse() instead' },
      { re: /\b(?:test|it|describe)(?:\.\w+)*\.(?:only|skip|fixme)\s*\(/g, msg: 'focused or skipped test (.only / .skip / .fixme) — it silently shrinks the suite' },
    ]
  : [
      { re: /\bThread\.sleep\s*\(|\bTimeUnit\.\w+\.sleep\s*\(/g, msg: 'fixed sleep (Thread.sleep / TimeUnit.sleep) — assert on state instead of waiting a fixed time' },
      { re: /@(?:Disabled|Ignore)\b/g, msg: 'disabled test (@Disabled / @Ignore) — it silently shrinks the suite' },
    ];

const ASSERTION = isTs
  ? /\bexpect\s*[.(]/
  : /\bassert\w*\s*\(|\.andExpect\s*\(|\bverify\s*\(|\bfail\s*\(/;
const TEST_DEF = isTs ? /\b(?:test|it)\s*\(/ : /@(?:Test|ParameterizedTest|RepeatedTest)\b/;

const count = (s, re) => (s.match(re) || []).length;

let before = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
let after;
if (tool === 'Write') {
  after = ti.content ?? '';
} else {
  const oldS = ti.old_string ?? '';
  const newS = ti.new_string ?? '';
  let base = before;
  if (!base.includes(oldS) && base.includes('\r\n')) base = base.replace(/\r\n/g, '\n');
  if (!oldS || !base.includes(oldS)) allow(); // the Edit itself will fail; nothing to judge
  before = base;
  after = ti.replace_all ? base.split(oldS).join(newS) : base.replace(oldS, () => newS);
}

const problems = RULES
  .filter(({ re }) => count(after, re) > count(before, re))
  .map(({ msg }) => msg);

if (TEST_DEF.test(after) && !ASSERTION.test(after)) {
  problems.push(isTs
    ? 'the file defines tests but contains no expect(...) assertions'
    : 'the file defines tests but contains no assertions (assert*/andExpect/verify)');
}

if (problems.length) {
  deny(`Blocked by .claude/hooks/block-bad-tests.mjs — this change to ${p.split('/apps/')[1] ? 'apps/' + p.split('/apps/')[1] : p} adds:\n- ${problems.join('\n- ')}\nRewrite the test without these patterns. (See .claude/rules/testing-*.md.)`);
}
allow();
