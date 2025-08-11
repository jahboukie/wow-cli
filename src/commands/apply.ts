import fs from 'fs-extra';
import path from 'path';
import { applyUnifiedDiff, newBranch, stageAll, commitAll } from '../core/git.js';
import { watchdogGate } from '../core/watchdog.js';
import { logEvent } from '../core/ledger.js';

async function readAllStdin(): Promise<string> {
  return await new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

export async function applyCommand(opts: { fromFile?: string; message?: string; json?: boolean }) {
  const patch = opts.fromFile ? await fs.readFile(path.resolve(opts.fromFile), 'utf-8') : await readAllStdin();
  if (!patch || !patch.trim()) {
    const msg = 'No patch provided. Use --from-file <path> or pipe a unified diff via stdin.';
    if (opts.json) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(msg);
    return;
  }

  const branch = await newBranch('patch');
  await applyUnifiedDiff(patch);
  await stageAll();
  const gate = await watchdogGate();
  if (!gate.ok) {
    await logEvent('error', { msg: 'watchdog blocked', issues: gate.issues });
    if (opts.json) console.log(JSON.stringify({ ok: false, branch, issues: gate.issues }));
    else console.error('Watchdog blocked commit:', gate.issues);
    return;
  }
  await commitAll(opts.message || 'apply patch');
  await logEvent('git.commit', { branch, message: opts.message || 'apply patch' });
  if (opts.json) console.log(JSON.stringify({ ok: true, branch }));
  else console.log(`✅ Patch applied on ${branch}`);
}
