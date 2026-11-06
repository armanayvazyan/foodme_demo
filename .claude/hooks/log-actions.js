#!/usr/bin/env node
// Logs every prompt and action Claude takes to .claude/logs/actions.log
const fs = require('fs');
const path = require('path');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const input = JSON.parse(raw);
  const t = input.tool_input || {};

  const labels = { UserPromptSubmit: 'PROMPT', PreToolUse: 'TRY ', PostToolUse: 'DONE' };
  const label = labels[input.hook_event_name] || input.hook_event_name;

  let detail = '';
  if (input.hook_event_name === 'UserPromptSubmit') detail = input.prompt || '';
  else detail = `${input.tool_name}: ${t.command || t.file_path || t.pattern || t.url || ''}`;

  const time = new Date().toLocaleString('en-GB');
  const line = `${time} | ${label} | ${detail.replace(/\s+/g, ' ').slice(0, 200)}\n`;

  const dir = path.join(process.env.CLAUDE_PROJECT_DIR || '.', '.claude', 'logs');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'actions.log'), line);
  process.exit(0); // never block anything
});
