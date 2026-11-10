#!/usr/bin/env node
// Bug ID tracker hook.
// PostToolUse (Write/Edit): finds bug IDs (FM-BUG-<number>) near edited code and reminds Claude.
// PreToolUse (Bash): blocks "git commit" if the message doesn't mention those bug IDs.
//
// To keep false positives down:
// - Files outside the project folder (for example ~/.claude/plans) are ignored.
// - A bug ID is only remembered if the edited lines are within NEARBY_LINES of its marker.
// - A commit whose message contains "[no-bug-fix]" is allowed: it says the change touches code
//   near a bug marker but doesn't fix that bug.
const fs = require('fs');
const path = require('path');

const BUG_ID = /FM-BUG-\d+/g;
const NEARBY_LINES = 2;
const NO_BUG_FIX = '[no-bug-fix]';
const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
const trackFile = path.join(projectDir, '.claude', 'logs', 'bug-ids.txt');

const readTracked = () =>
  fs.existsSync(trackFile) ? fs.readFileSync(trackFile, 'utf8').split('\n').filter(Boolean) : [];
const writeTracked = (ids) => {
  fs.mkdirSync(path.dirname(trackFile), { recursive: true });
  fs.writeFileSync(trackFile, ids.length ? ids.join('\n') + '\n' : '');
};

// Resolves symlinks (e.g. /tmp -> /private/tmp, .claude/rules -> .agents/rules) before comparing.
const realPath = (p) => {
  try { return fs.realpathSync(p); } catch { return path.resolve(p); }
};
const isInsideProject = (file) => {
  const rel = path.relative(realPath(projectDir), realPath(path.resolve(projectDir, file)));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

// Line index where an edited piece starts in the file, or -1 if it can't be found.
// Matches the whole piece first, so a common first line such as "}" doesn't pick the wrong spot.
const findEditStart = (content, lines, piece) => {
  const at = content.indexOf(piece);
  if (at >= 0) return content.slice(0, at).split('\n').length - 1;
  const firstLine = piece.split('\n').map((l) => l.trim()).find(Boolean);
  return firstLine ? lines.findIndex((l) => l.includes(firstLine)) : -1;
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
    if (!isInsideProject(file)) process.exit(0); // plans, scratch files, etc.
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const ids = new Set();

    if (input.tool_name === 'Write') {
      // A full rewrite has no "edited lines" to compare against, so every marker in the file counts.
      (content.match(BUG_ID) || []).forEach((id) => ids.add(id));
    } else {
      const pieces = input.tool_name === 'Edit'
        ? [t.new_string || '']
        : (t.edits || []).map((e) => e.new_string || '');
      for (const piece of pieces) {
        if (!piece.trim()) continue; // pure deletion: nothing left to locate
        const start = findEditStart(content, lines, piece);
        if (start < 0) continue;
        const end = start + piece.split('\n').length - 1; // last edited line
        const nearby = lines.slice(Math.max(0, start - NEARBY_LINES), end + NEARBY_LINES + 1).join('\n');
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
      `- If this fixes the bug: mention ${newIds.join(', ')} in the commit message and make sure a test covers it (write-unit-tests skill).\n` +
      `- If it only touches nearby code without fixing the bug: put "${NO_BUG_FIX}" in the commit message instead.\n` +
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

    if (cmd.includes(NO_BUG_FIX)) {
      writeTracked([]); // declared as not a bug fix: forget the IDs
      process.exit(0);
    }

    const missing = tracked.filter((id) => !cmd.includes(id));
    if (missing.length > 0) {
      console.error(
        `Blocked by bug-id-tracker hook: this commit changes code near ${missing.join(', ')}, ` +
        'but the commit message does not mention it.\n' +
        `- If it fixes the bug, add the ID, for example: git commit -m "${missing[0]}: <what you fixed>"\n` +
        `- If it doesn't fix the bug, add "${NO_BUG_FIX}" to the message.`
      );
      process.exit(2); // block the commit
    }
    writeTracked([]); // all IDs mentioned: forget them
    process.exit(0);
  }

  process.exit(0);
});
