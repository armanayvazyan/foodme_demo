#!/usr/bin/env node
// PreToolUse(Edit|MultiEdit|Write) on test files: refuse to add bad tests.
//
// The hook compares the file before and after the edit and only blocks problems the edit
// INTRODUCES, so pre-existing issues (e.g. the planted FM-FLAKE-01 sleep) never stop
// unrelated work. Every rule explains the fix, so Claude can correct itself and retry.
import {
  isMain,
  logAction,
  preToolDecision,
  projectedContent,
  readInput,
  relPath,
  run,
} from "./lib/hook-io.mjs";

const TICKET = /\b(SCRUM|FM-(?:BUG|FLAKE))-\d+\b/;

export function kindOf(rel) {
  if (/\.(spec|test)\.[cm]?[jt]sx?$/.test(rel)) return "ts";
  if (/src\/test\/java\/.+\.java$/.test(rel)) return "java";
  return null;
}

/** Remove comments so commented-out code neither triggers nor satisfies rules. Keeps line count. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/**
 * Body of the function starting after `from`: the first "{" that follows "=>" or ")"
 * (so `async ({ page }) => {` skips the destructuring braces), via brace matching.
 */
function blockAfter(src, from, kind = "ts") {
  const re = kind === "java" ? /\{/g : /(=>|\))\s*\{/g;
  re.lastIndex = from;
  const m = re.exec(src);
  if (!m) return "";
  const open = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

function lineAt(src, idx) {
  return src.slice(0, idx).split("\n").length;
}

function hasTicketNear(raw, line) {
  const lines = raw.split("\n");
  return [line - 3, line - 2, line - 1].some((n) => n >= 0 && TICKET.test(lines[n] || ""));
}

const TS_ASSERT =
  /\b(expect|assert)\w*\s*[.(]|\.(toHave|toBe|toEqual|toMatch|toContain|toThrow|rejects|resolves)\w*\(|\b(expect|assert|verify|check|should)[A-Z]\w*\s*\(/;
const JAVA_ASSERT =
  /\b(assert\w*|assertThat|assertThrows|fail|verify\w*|andExpect|expect\w*|then)\s*\(/;

/** Returns violations as { key, message } so before/after can be diffed by key multiplicity. */
export function findViolations(content, kind) {
  if (!content) return [];
  const raw = content;
  const src = stripComments(content);
  const out = [];
  const add = (key, message) => out.push({ key, message });

  if (kind === "ts") {
    for (const m of src.matchAll(/\b(test|it|describe)\.only\s*\(/g)) {
      add(
        `only`,
        `\`${m[0].trim()}\` (line ${lineAt(src, m.index)}) would silently skip the rest of the suite. Remove \`.only\`; run a single test with \`npx playwright test -g "<title>"\` or \`npx vitest run -t "<title>"\`.`,
      );
    }
    for (const m of src.matchAll(/\b(waitForTimeout|setTimeout)\s*\(/g)) {
      if (
        m[1] === "setTimeout" &&
        !/await\s+new\s+Promise/.test(src.slice(Math.max(0, m.index - 40), m.index))
      )
        continue;
      add(
        `sleep`,
        `Hard wait \`${m[1]}(...)\` at line ${lineAt(src, m.index)} makes the test slow and flaky. Wait for a condition instead: \`await expect(locator).toBeVisible()\`, \`toHaveCount\`, \`page.waitForResponse(...)\`, or \`expect.poll(...)\`.`,
      );
    }
    for (const m of src.matchAll(/\b(test|it|describe)\.(skip|fixme|todo|fails)\s*\(/g)) {
      const line = lineAt(src, m.index);
      if (!hasTicketNear(raw, line)) {
        add(
          `skip:${m[2]}`,
          `\`${m[0].trim()}\` at line ${line} needs a Jira key (e.g. \`// SCRUM-12: <why>\`) on the same or previous line, so the skipped/known-failing test is tracked and gets re-enabled.`,
        );
      }
    }
    for (const m of src.matchAll(/test\.describe\.configure\s*\(\s*\{[^}]*retries/g)) {
      add(
        `retries`,
        `Per-file \`retries\` (line ${lineAt(src, m.index)}) hides flakiness. Fix the race; retries are configured centrally in playwright.config.ts for CI only.`,
      );
    }
    for (const m of src.matchAll(
      /expect\s*\(\s*(?:true|false|null|undefined|\d+|"[^"]*"|'[^']*')\s*\)\s*\.\s*(?:(?:toBe|toEqual|toStrictEqual)\s*\(\s*(?:true|false|null|undefined|\d+|"[^"]*"|'[^']*')\s*\)|(?:toBeTruthy|toBeFalsy|toBeDefined|toBeNull)\s*\(\s*\))/g,
    )) {
      add(
        `tautology`,
        `\`${m[0]}\` (line ${lineAt(src, m.index)}) asserts a constant and can never fail. Assert on the value produced by the code under test.`,
      );
    }
    for (const m of src.matchAll(/catch\s*(\([^)]*\))?\s*\{\s*\}/g)) {
      add(
        `empty-catch`,
        `Empty catch block at line ${lineAt(src, m.index)} swallows assertion errors, so the test can never fail. Let errors propagate or use \`await expect(...).rejects\`.`,
      );
    }
    // Tests without any assertion. Title-keyed so pre-existing ones are not re-reported.
    for (const m of src.matchAll(
      /\b(?:test|it)(?:\.(?:fails|concurrent|serial))?\s*\(\s*(["'`])((?:(?!\1).)*)\1/g,
    )) {
      const body = blockAfter(src, m.index + m[0].length);
      if (!TS_ASSERT.test(body)) {
        add(
          `no-assert:${m[2]}`,
          `Test "${m[2]}" has no assertion, so it only proves the code didn't throw. Add an \`expect(...)\` on the observable outcome.`,
        );
      }
    }
    if (/\bpage\.goto\(\s*["'`]https?:\/\/localhost/.test(src)) {
      add(
        `hardcoded-url`,
        `Use relative paths with \`page.goto("/route")\` — baseURL comes from playwright.config.ts (PLAYWRIGHT_BASE_URL / ADMIN_BASE_URL), so tests also run against deployed environments.`,
      );
    }
  }

  if (kind === "java") {
    for (const m of src.matchAll(/\bThread\.sleep\s*\(|\bTimeUnit\.\w+\.sleep\s*\(/g)) {
      add(
        `sleep`,
        `\`${m[0]}...\` at line ${lineAt(src, m.index)}: hard sleeps make the suite slow and flaky. Assert on state directly; for async code poll with a bounded loop or Awaitility.`,
      );
    }
    for (const m of src.matchAll(/@Disabled\b(\s*\(\s*"([^"]*)"\s*\))?/g)) {
      if (!m[2] || !TICKET.test(m[2])) {
        add(
          `disabled`,
          `\`@Disabled\` at line ${lineAt(src, m.index)} needs a reason with a Jira key, e.g. \`@Disabled("SCRUM-12: flaky under H2, fix pending")\`.`,
        );
      }
    }
    for (const m of src.matchAll(
      /assert(True|False)\s*\(\s*(true|false)\s*\)|assertEquals\s*\(\s*([^,()]+)\s*,\s*\3\s*\)|assertThat\s*\(\s*(true|false)\s*\)/g,
    )) {
      add(
        `tautology`,
        `\`${m[0]}\` (line ${lineAt(src, m.index)}) can never fail. Assert on the result of the code under test.`,
      );
    }
    for (const m of src.matchAll(/catch\s*\([^)]*\)\s*\{\s*\}/g)) {
      add(
        `empty-catch`,
        `Empty catch at line ${lineAt(src, m.index)} hides failures. Use \`assertThrows\` / \`assertThatThrownBy\`, or let the exception fail the test.`,
      );
    }
    for (const m of src.matchAll(
      /@(?:Test|ParameterizedTest|RepeatedTest)\b[\s\S]*?\bvoid\s+(\w+)\s*\(/g,
    )) {
      const body = blockAfter(src, m.index + m[0].length, "java");
      if (!JAVA_ASSERT.test(body)) {
        add(
          `no-assert:${m[1]}`,
          `Test method \`${m[1]}()\` has no assertion (assertThat/assertEquals/assertThrows/verify/andExpect). Add one on the observable outcome.`,
        );
      }
    }
  }
  return out;
}

/** Violations present after the edit more often than before it. */
export function newViolations(before, after, kind) {
  const count = (list) => list.reduce((m, v) => m.set(v.key, (m.get(v.key) || 0) + 1), new Map());
  const b = count(findViolations(before, kind));
  const seen = new Map();
  return findViolations(after, kind).filter((v) => {
    const n = (seen.get(v.key) || 0) + 1;
    seen.set(v.key, n);
    return n > (b.get(v.key) || 0);
  });
}

if (isMain(import.meta.url)) {
  run(async () => {
    const input = await readInput();
    const ti = input.tool_input || {};
    const rel = relPath(ti.file_path);
    const kind = kindOf(rel);
    if (!kind) return;
    const { before, after } = projectedContent(input.tool_name, ti);
    const found = newViolations(before, after, kind);
    if (!found.length) return;

    const reason = [
      `[foodme test-quality] Blocked: this change adds ${found.length} test problem(s) to ${rel}:`,
      ...found.map((v, i) => `${i + 1}. ${v.message}`),
      "Fix them and retry. Conventions: .claude/rules/testing.md.",
    ].join("\n");
    logAction({
      session: input.session_id,
      event: "guard",
      hook: "test-quality",
      decision: "deny",
      file: rel,
      rules: found.map((v) => v.key),
    });
    preToolDecision("deny", reason);
  });
}
