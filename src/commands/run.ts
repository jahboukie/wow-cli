import { execa } from 'execa';
import { logEvent } from '../core/ledger.js';

export async function runCommand(cmd: string, opts: { json?: boolean } = {}) {
  const started = Date.now();
  try {
    const child = execa(cmd, { shell: true, stdout: 'inherit', stderr: 'inherit' });
    const res = await child;
    const payload = { cmd, code: res.exitCode ?? 0, ms: Date.now() - started };
    await logEvent('run', payload);
    if (opts.json) console.log(JSON.stringify({ ok: true, ...payload }));
    else console.log(`✔ ${cmd} [${payload.code}] in ${payload.ms}ms`);
    return payload;
  } catch (err: any) {
    const payload = { cmd, code: err.exitCode ?? 1, ms: Date.now() - started };
    await logEvent('run', payload);
    if (opts.json) console.log(JSON.stringify({ ok: false, ...payload }));
    else console.log(`✖ ${cmd} [${payload.code}] in ${payload.ms}ms`);
    return payload;
  }
}
