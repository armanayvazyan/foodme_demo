#!/usr/bin/env node
// PostToolUse hook (Write|Edit|MultiEdit): formats the edited file with Prettier.
// Never blocks: any problem (bad input, Prettier missing, Prettier error) prints a short note and exits 0.
const { readFileSync, existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const FORMATTABLE = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.md', '.html', '.yml', '.yaml']);

function done(note) {
  if (note) process.stdout.write(`format-after-edit: ${note}\n`);
  process.exit(0);
}

try {
  let filePath;
  try {
    filePath = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.file_path;
  } catch {
    done();
  }
  if (!filePath || !FORMATTABLE.has(path.extname(filePath).toLowerCase()) || !existsSync(filePath)) done();

  // Run from the file's own folder so npx finds the nearest node_modules (apps/web, apps/admin, ...).
  const result = spawnSync('npx', ['--no-install', 'prettier', '--write', `"${filePath}"`], {
    cwd: path.dirname(filePath),
    shell: true, // npx is npx.cmd on Windows
    encoding: 'utf8',
    timeout: 30000,
  });

  if (result.error) done(`skipped ${path.basename(filePath)} (${result.error.message})`);
  if (result.status !== 0) {
    const msg = `${result.stderr || result.stdout || ''}`.trim().split('\n')[0] || `exit ${result.status}`;
    done(`Prettier did not format ${path.basename(filePath)}: ${msg}`);
  }
  done();
} catch (err) {
  done(`skipped (${err && err.message ? err.message : err})`);
}
