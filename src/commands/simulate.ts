import path from 'path';
import { runJsSandbox } from '../core/sandbox.js';

export async function simulateCommand(file: string, opts: { timeout?: number; json?: boolean } = {}) {
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const res = await runJsSandbox({ file: abs, timeoutMs: opts.timeout });
  if (opts.json) {
    console.log(JSON.stringify(res));
  } else {
    if (res.ok) console.log('ok', res.result);
    else console.error('error', res.error);
  }
  if (!res.ok) process.exitCode = 1;
}
