import { execa } from 'execa';
import { logEvent } from '../core/ledger.js';
import { runProcessSandbox } from '../core/sandbox.js';

export async function runCommand(cmd: string | string[], opts: { json?: boolean; sandbox?: boolean } = {}) {
  const started = Date.now();
  try {
    let code = 0;
    if (opts.sandbox) {
  const parts = Array.isArray(cmd) ? cmd : splitArgs(cmd);
  const [bin, ...args] = parts;
      const r = await runProcessSandbox({ cmd: bin, args, timeoutMs: 30000, copyCwd: true });
      if (r.stdout) process.stdout.write(r.stdout + '\n');
      if (r.stderr) process.stderr.write(r.stderr + '\n');
      code = r.code;
    } else {
  const commandStr = Array.isArray(cmd) ? cmd.join(' ') : cmd;
  const child = execa(commandStr, { shell: true, stdout: 'inherit', stderr: 'inherit' });
      const res = await child;
      code = res.exitCode ?? 0;
    }
    const payload = { cmd, code, ms: Date.now() - started };
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

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === quote) { quote = null; }
      else if (ch === '\\' && i + 1 < s.length) { cur += s[++i]; }
      else { cur += ch; }
    } else {
      if (ch === '"' || ch === "'") { quote = ch as any; }
      else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
      else { cur += ch; }
    }
  }
  if (cur) out.push(cur);
  return out;
}
