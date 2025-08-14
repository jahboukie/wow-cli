import fs from 'fs-extra';
import path from 'path';
import { logEvent } from '../core/ledger.js';
import { ensureGit } from '../core/git.js';

export async function initCommand(opts: { json?: boolean }) {
  await ensureGit();
  const dir = path.join(process.cwd(), '.wow');
  await fs.ensureDir(dir);
  await logEvent('info', { msg: 'init' });
  if (opts?.json) {
    console.log(JSON.stringify({ ok: true, action: 'init' }));
  } else {
    console.log('✅ Initialized .wow ledger');
  }
}
