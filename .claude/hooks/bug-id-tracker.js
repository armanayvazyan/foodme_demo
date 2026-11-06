#!/usr/bin/env node
// Bug ID tracker hook.
// PostToolUse (Write/Edit): finds bug IDs like FM-BUG-07 near edited code and reminds Claude.
// PreToolUse (Bash): blocks "git commit" if the message doesn't mention those bug IDs.
const fs = require('fs');
const path = require('path');

const BUG_ID = /FM-BUG-\d+/g;
const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
const trackFile = path.join(projectDir, '.claude', 'logs', 'bug-ids.txt');

const readTracked = () =>
  fs.existsSync(trackFile) ? fs.readFileSync(trackFile, 'utf8').split('\n').filter(Boolean) : [];
const writeTracked = (ids) => {
  fs.mkdirSync(path.dirname(trackFile), { recursive: true });
  fs.writeFileSync(trackFile, ids.length ? ids.join('\n') + '\n' : '');
};

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const input = JSON.parse(raw);
  const t = input.tool_input || {};

  // ---- Part A: after an edit, look for bug IDs near the change ----
  if (input.hook_event_name === 'PostToolUse') {
    const file = t.file_path;
    if (!file || !fs.existsSync(file)) process.exit(0);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const ids = new Set();

    if (input.tool_name === 'Write') {
      (lines.join('\n').match(BUG_ID) || []).forEach((id) => ids.add(id));
    } else {
      const pieces = input.tool_name === 'Edit'
        ? [t.new_string || '']
        : (t.edits || []).map((e) => e.new_string || '');
      for (const piece of pieces) {
        const firstLine = piece.split('\n')[0].trim();
        if (!firstLine) continue;
        const at = lines.findIndex((l) => l.includes(firstLine));
        if (at < 0) continue;
        const size = piece.split('\n').length;
        const nearby = lines.slice(Math.max(0, at - 5), at + size + 5).join('\n');
        (nearby.match(BUG_ID) || []).forEach((id) => ids.add(id));
      }
    }

    if (ids.size === 0) process.exit(0);
    const tracked = readTracked();
    const newIds = [...ids].filter((id) => !tracked.includes(id));
    writeTracked([...new Set([...tracked, ...ids])]);
    if (newIds.length === 0) process.exit(0); // already reminded

    console.error(
      `bug-id-tracker hook: you changed code next to ${newIds.join(', ')} in ${path.relative(projectDir, file)}.\n` +
      `- Mention ${newIds.join(', ')} in the commit message.\n` +
      '- Make sure a test covers this bug (write-unit-tests skill).\n' +
      '- Offer the user to update the matching Jira ticket with the jira-workflow skill (ask first).'
    );
    process.exit(2); // shows this message to Claude (the edit itself already happened)
  }

  // ---- Part B: before a commit, check the message mentions the bug IDs ----
  if (input.hook_event_name === 'PreToolUse' && input.tool_name === 'Bash') {
    const cmd = t.command || '';
    if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0);
    const tracked = readTracked();
    if (tracked.length === 0) process.exit(0);

    const missing = tracked.filter((id) => !cmd.includes(id));
    if (missing.length > 0) {
      console.error(
        `Blocked by bug-id-tracker hook: this commit fixes code near ${missing.join(', ')}, ` +
        'but the commit message does not mention it.\n' +
        `Add it to the message, for example: git commit -m "${missing[0]}: <what you fixed>"`
      );
      process.exit(2); // block the commit
    }
    writeTracked([]); // all IDs mentioned: forget them
    process.exit(0);
  }

  process.exit(0);
});
