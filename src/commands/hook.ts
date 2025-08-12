import fs from 'fs-extra';
import path from 'path';

const HOOK_HEADER = '#!/bin/sh\n# installed by wow hook install\n';

export async function hookCommand(sub: string, opts: { json?: boolean } = {}) {
  if (sub !== 'install') {
    if (opts.json) console.log(JSON.stringify({ ok: false, error: 'unsupported-subcommand' }));
    else console.error('Unsupported hook subcommand');
    process.exitCode = 1;
    return;
  }
  const gitDir = path.join(process.cwd(), '.git');
  if (!(await fs.pathExists(gitDir))) {
    if (opts.json) console.log(JSON.stringify({ ok: false, error: 'no-git' })); else console.error('Not a git repository.');
    process.exitCode = 1;
    return;
  }
  const hooksDir = path.join(gitDir, 'hooks');
  await fs.ensureDir(hooksDir);
  const preCommit = path.join(hooksDir, 'pre-commit');
  let backupMade = false;
  if (await fs.pathExists(preCommit)) {
    const backup = preCommit + '.wow.bak';
    await fs.copy(preCommit, backup, { overwrite: true });
    backupMade = true;
  }
  const script = HOOK_HEADER + `node dist/cli.js scan --json || exit 1\n`;
  await fs.writeFile(preCommit, script, { mode: 0o755 });
  if (opts.json) console.log(JSON.stringify({ ok: true, installed: true, backupMade }));
  else console.log('Pre-commit hook installed.' + (backupMade ? ' (previous hook backed up)' : ''));
}

export async function scanCommand(opts: { json?: boolean } = {}) {
  const { watchdogGate } = await import('../core/watchdog.js');
  const result = await watchdogGate();
  if (opts.json) console.log(JSON.stringify(result));
  else {
    if (result.ok) console.log('scan ok'); else {
      console.error('scan failed:');
      for (const i of result.issues) console.error(` - ${i.type}: ${i.detail}`);
    }
  }
  if (!result.ok) process.exitCode = 1;
}
