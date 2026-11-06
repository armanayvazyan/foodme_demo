#!/usr/bin/env node
// PreToolUse hook: blocks bad test code before Claude writes it.
// Checks Write, Edit, MultiEdit and Bash (shell writes to test files).
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const input = JSON.parse(raw);
  const t = input.tool_input || {};
  const testFile = /\.(test|spec)\.[jt]sx?|Test\.java/;

  let file = '';
  let newCode = '';
  let oldCode = '';

  if (input.tool_name === 'Bash') {
    const cmd = t.command || '';
    if (!testFile.test(cmd)) process.exit(0); // command doesn't touch a test file
    file = '(shell command)';
    newCode = cmd;
  } else {
    file = t.file_path || '';
    if (!testFile.test(file)) process.exit(0); // not a test file
    if (input.tool_name === 'Write') {
      newCode = t.content || '';
    } else if (input.tool_name === 'Edit') {
      newCode = t.new_string || '';
      oldCode = t.old_string || '';
    } else if (input.tool_name === 'MultiEdit') {
      for (const e of t.edits || []) {
        newCode += (e.new_string || '') + '\n';
        oldCode += (e.old_string || '') + '\n';
      }
    }
  }

  const problems = [];
  const badPatterns = [
    [/\b(it|test|describe)\.(skip|only)\s*\(/, 'uses .skip or .only'],
    [/\bx(it|describe)\s*\(/, 'uses xit/xdescribe (skipped test)'],
    [/@Disabled\b/, 'uses @Disabled (skipped test)'],
    [/waitForTimeout\s*\(/, 'uses waitForTimeout (hard-coded wait)'],
    [/Thread\.sleep\s*\(/, 'uses Thread.sleep (hard-coded wait)'],
    [/expect\(\s*true\s*\)\.toBe\(\s*true\s*\)/, 'has a fake assertion: expect(true).toBe(true)'],
  ];
  for (const [re, msg] of badPatterns) {
    if (re.test(newCode)) problems.push(msg);
  }

  const countAsserts = (s) =>
    (s.match(/\bexpect\s*\(|\bassert\w*\s*\(/g) || []).length;

  if (input.tool_name === 'Write' && /\b(it|test)\s*\(|@Test\b/.test(newCode) && countAsserts(newCode) === 0) {
    problems.push('has tests with no assertions');
  }
  if (oldCode && countAsserts(newCode) < countAsserts(oldCode)) {
    problems.push(`removes assertions (${countAsserts(oldCode)} -> ${countAsserts(newCode)})`);
  }

  if (problems.length > 0) {
    console.error(
      `Blocked by block-bad-tests hook: ${file}\n- ${problems.join('\n- ')}\n` +
      'Fix the test properly instead. See .claude/rules/testing.md.'
    );
    process.exit(2);
  }
  process.exit(0);
});
