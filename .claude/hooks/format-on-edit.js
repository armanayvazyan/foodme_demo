#!/usr/bin/env node
// PostToolUse hook: formats a file with Prettier after Claude edits it.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const file = (JSON.parse(raw).tool_input || {}).file_path;
  if (!file || !fs.existsSync(file)) process.exit(0);
  if (!/\.(ts|tsx|js|jsx|json|css)$/.test(file)) process.exit(0);

  // Find the nearest folder that has Prettier installed
  let dir = path.dirname(file);
  while (dir !== path.dirname(dir)) {
    const prettier = path.join(dir, 'node_modules', '.bin', 'prettier');
    if (fs.existsSync(prettier)) {
      try {
        execFileSync(prettier, ['--write', file], { stdio: 'ignore' });
        console.log(`Formatted ${path.basename(file)} with Prettier`);
      } catch (e) {
        console.error(`Prettier could not format ${file}`);
      }
      process.exit(0);
    }
    dir = path.dirname(dir);
  }
  process.exit(0);
});
