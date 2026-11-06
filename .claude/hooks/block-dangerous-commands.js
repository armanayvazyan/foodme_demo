#!/usr/bin/env node
// PreToolUse hook: blocks dangerous shell commands before Claude runs them.
const { execSync } = require('child_process');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const cmd = (JSON.parse(raw).tool_input || {}).command || '';

  const rules = [
    [/\bgit\s+push\b.*\b(main|master)\b/, 'pushing directly to main/master'],
    [/\bgit\s+push\b.*(--force\b|\s-f\b)/, 'force push'],
    [/\bgit\s+reset\s+--hard\b/, 'git reset --hard (deletes uncommitted work)'],
    [/\bgit\s+clean\s+-\w*f/, 'git clean -f (deletes untracked files)'],
    [/\brm\s+(-\w+\s+)*-\w*([rR]f|f[rR])/, 'rm -rf'],
    [/\brm\s+.*-[rR]\b.*-f\b|\brm\s+.*-f\b.*-[rR]\b/, 'rm -r -f'],
    [/\bsudo\b/, 'sudo'],
    [/\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b/, 'piping a download into a shell'],
    [/\bchmod\s+(-R\s+)?777\b/, 'chmod 777'],
    [/\bDROP\s+(TABLE|DATABASE)\b/i, 'dropping a database table'],
  ];

  const problems = rules.filter(([re]) => re.test(cmd)).map(([, msg]) => msg);

  // A plain "git push" while on main is also a push to main
  if (problems.length === 0 && /\bgit\s+push(\s+origin)?\s*($|&&|;|\|)/.test(cmd)) {
    try {
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      if (branch === 'main' || branch === 'master') {
        problems.push(`git push while on branch ${branch}`);
      }
    } catch (e) {}
  }

  if (problems.length > 0) {
    console.error(
      `Blocked by block-dangerous-commands hook: ${problems.join(', ')}\n` +
      `Command: ${cmd}\n` +
      'Do not try another way. Tell the user, and let them run it themselves if it is really needed.'
    );
    process.exit(2); // block
  }
  process.exit(0); // allow
});
