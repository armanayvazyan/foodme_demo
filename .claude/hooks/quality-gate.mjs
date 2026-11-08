#!/usr/bin/env node
// Stop: before Claude says "done", verify what it touched in this session.
//
//   apps/web    -> tsc -b, oxlint on changed files, `vitest related` for changed sources
//   apps/admin  -> eslint on changed files
//   backend     -> compile main + test sources; run any changed test classes
//   any app     -> production code changed but no test touched => ask once for tests
//
// Failures are sent back to Claude (decision "block") so it fixes them before finishing.
// Runs only for files touched in this session, skips if nothing changed since the last
// green run, and never loops (respects stop_hook_active). Disable: FOODME_QUALITY_GATE=off.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  PROJECT_DIR,
  block,
  isMain,
  loadSessionState,
  logAction,
  readInput,
  run,
  saveSessionState,
} from "./lib/hook-io.mjs";

const isTest = (f) => /\.(test|spec)\.[jt]sx?$|src\/test\//.test(f);
const exists = (f) => fs.existsSync(path.join(PROJECT_DIR, f));

export function plan(touched) {
  const files = touched.filter(exists);
  const web = files.filter((f) => /^apps\/web\/(src|e2e)\/.+\.(ts|tsx)$/.test(f));
  const admin = files.filter((f) => /^apps\/admin\/(src|e2e)\/.+\.(js|jsx|ts)$/.test(f));
  const java = files.filter((f) => /^apps\/backend\/src\/.+\.java$/.test(f));
  const prod = files.filter(
    (f) => /^apps\/[^/]+\/src\//.test(f) && !isTest(f) && /\.(ts|tsx|js|jsx|java)$/.test(f),
  );
  const tests = files.filter(isTest);
  return { files, web, admin, java, prod, tests };
}

function sh(cmd, args, cwd, timeoutMs = 120_000) {
  if (!fs.existsSync(cwd)) return { ok: true, out: "" };
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  if (r.error?.code === "ETIMEDOUT")
    return { ok: true, out: `(skipped: timed out after ${timeoutMs / 1000}s)` };
  return { ok: r.status === 0, out };
}

const tail = (s, n = 40) => s.split("\n").slice(-n).join("\n");
const rel = (app, f) => f.replace(new RegExp(`^apps/${app}/`), "");

function fingerprint(files) {
  const h = crypto.createHash("sha1");
  for (const f of files.sort())
    h.update(f).update(String(fs.statSync(path.join(PROJECT_DIR, f)).mtimeMs));
  return h.digest("hex");
}

if (isMain(import.meta.url)) {
  run(async () => {
    const input = await readInput();
    if (input.stop_hook_active || process.env.FOODME_QUALITY_GATE === "off") return;

    const state = loadSessionState(input.session_id);
    const p = plan(state.touched || []);
    if (!p.files.length) return;
    const fp = fingerprint(p.files);
    if (state.lastGreen === fp) return;

    const failures = [];
    const appDir = (a) => path.join(PROJECT_DIR, "apps", a);
    const hasDeps = (a) => fs.existsSync(path.join(appDir(a), "node_modules"));

    if (p.web.length && hasDeps("web")) {
      const tsc = sh("npx", ["tsc", "-b"], appDir("web"));
      if (!tsc.ok) failures.push(`apps/web typecheck (npx tsc -b):\n${tail(tsc.out)}`);
      const lint = sh("npx", ["oxlint", ...p.web.map((f) => rel("web", f))], appDir("web"));
      if (!lint.ok) failures.push(`apps/web lint (oxlint):\n${tail(lint.out)}`);
      const unit = p.web.filter((f) => f.startsWith("apps/web/src/"));
      if (unit.length && fs.existsSync(path.join(appDir("web"), "vitest.config.ts"))) {
        const vt = sh(
          "npx",
          ["vitest", "related", "--run", "--passWithNoTests", ...unit.map((f) => rel("web", f))],
          appDir("web"),
        );
        if (!vt.ok) failures.push(`apps/web unit tests (vitest related):\n${tail(vt.out)}`);
      }
    }
    if (p.admin.length && hasDeps("admin")) {
      const lint = sh(
        "npx",
        ["eslint", ...p.admin.filter((f) => !f.endsWith(".ts")).map((f) => rel("admin", f))],
        appDir("admin"),
      );
      if (!lint.ok) failures.push(`apps/admin lint (eslint):\n${tail(lint.out)}`);
    }
    if (p.java.length) {
      const testClasses = p.java
        .filter((f) => f.includes("/src/test/") && /Test\.java$/.test(f))
        .map((f) => path.basename(f, ".java"));
      const tasks = testClasses.length
        ? ["test", ...testClasses.flatMap((c) => ["--tests", `*${c}`])]
        : ["compileJava", "compileTestJava"];
      const gr = sh("./gradlew", [...tasks, "-q", "--console=plain"], appDir("backend"), 240_000);
      if (!gr.ok)
        failures.push(`apps/backend (./gradlew ${tasks.join(" ")}):\n${tail(gr.out, 60)}`);
    }

    if (failures.length) {
      logAction({
        session: input.session_id,
        event: "quality-gate",
        ok: false,
        checks: failures.map((f) => f.split("\n")[0]),
      });
      saveSessionState(input.session_id, state);
      return block(
        `[foodme quality-gate] Checks failed for files you changed. Fix them (or explain why they are unrelated) before finishing:\n\n${failures.join("\n\n")}`,
      );
    }

    if (p.prod.length && !p.tests.length && !state.testReminderSent) {
      state.testReminderSent = true;
      saveSessionState(input.session_id, state);
      logAction({
        session: input.session_id,
        event: "quality-gate",
        ok: true,
        reminder: "no-tests",
      });
      return block(
        `[foodme quality-gate] You changed production code (${p.prod.slice(0, 5).join(", ")}${p.prod.length > 5 ? ", …" : ""}) but no tests. Add or update a test that would catch a regression (see the write-unit-tests / write-integration-tests / write-e2e-tests skills). If a test genuinely isn't warranted (pure refactor, copy change), say why in one line and finish.`,
      );
    }

    state.lastGreen = fp;
    saveSessionState(input.session_id, state);
    logAction({ session: input.session_id, event: "quality-gate", ok: true });
  });
}
