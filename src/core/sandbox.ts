import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Worker } from 'worker_threads';
import { execa } from 'execa';

export type JsSimOptions = {
  file: string; // path to JS module exporting async function main()
  timeoutMs?: number;
};

export async function runJsSandbox(opts: JsSimOptions): Promise<{ ok: boolean; result?: any; error?: string }> {
  const timeout = opts.timeoutMs ?? 5000;
  const workerPath = path.join(os.tmpdir(), `wow-sim-worker-${Date.now()}.mjs`);
  const workerCode = `
    import { parentPort, workerData } from 'worker_threads';
    const { modPath } = workerData;
    const safeConsole = { log: (...a) => {} };
    Object.defineProperty(globalThis, 'console', { value: safeConsole, writable: false, configurable: false });
    try {
      const mod = await import(modPath);
      if (typeof mod.main !== 'function') throw new Error('Module must export async function main()');
      const res = await Promise.race([
        mod.main(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ${timeout}))
      ]);
      parentPort?.postMessage({ ok: true, result: res });
    } catch (e) {
      parentPort?.postMessage({ ok: false, error: String(e && e.message || e) });
    }
  `;
  await fs.writeFile(workerPath, workerCode, 'utf-8');
  try {
    const res = await new Promise<{ ok: boolean; result?: any; error?: string }>((resolve) => {
      const w = new Worker(workerPath, { workerData: { modPath: pathToFileUrl(opts.file) } as any });
      const t = setTimeout(() => { w.terminate(); resolve({ ok: false, error: 'timeout' }); }, timeout + 100);
      w.once('message', (m) => { clearTimeout(t); resolve(m); });
      w.once('error', (e) => { clearTimeout(t); resolve({ ok: false, error: String(e) }); });
      w.once('exit', (code) => { /* no-op */ });
    });
    return res;
  } finally {
    await fs.remove(workerPath);
  }
}

function pathToFileUrl(p: string) {
  let resolved = path.resolve(p).replace(/\\/g, '/');
  if (!resolved.startsWith('/')) resolved = '/' + resolved;
  return 'file://' + resolved;
}

export type ProcSandboxOptions = {
  cmd: string;
  args?: string[];
  timeoutMs?: number;
  allowlist?: string[]; // allowed base executables (e.g., ['node','npm','tsc'])
  copyCwd?: boolean; // run in a temp copy of cwd
  env?: Record<string, string>;
};

export async function runProcessSandbox(opts: ProcSandboxOptions): Promise<{ code: number; stdout: string; stderr: string; cwd: string }> {
  const timeout = opts.timeoutMs ?? 15000;
  const base = path.basename(opts.cmd).toLowerCase();
  const allow = (opts.allowlist && opts.allowlist.length > 0) ? opts.allowlist.map((s) => s.toLowerCase()) : ['node', 'npm', 'npx', 'tsc'];
  if (!allow.includes(base)) {
    return { code: 126, stdout: '', stderr: `command not allowed in sandbox: ${base}`, cwd: process.cwd() };
  }
  let runCwd = process.cwd();
  if (opts.copyCwd) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wow-sbx-'));
    const toCopy = ['src', 'tests', 'package.json', 'tsconfig.json', 'eslint.config.js'];
    for (const item of toCopy) {
      const srcPath = path.join(process.cwd(), item);
      if (await fs.pathExists(srcPath)) {
        const dest = path.join(tmp, item);
        await fs.copy(srcPath, dest, { dereference: true, errorOnExist: false });
      }
    }
    runCwd = tmp;
  }
  try {
    const child = execa(opts.cmd, opts.args ?? [], { cwd: runCwd, env: { ...process.env, ...(opts.env || {}) }, timeout, shell: false });
    const { stdout, stderr, exitCode } = await child;
    return { code: exitCode ?? 0, stdout, stderr, cwd: runCwd };
  } catch (e: any) {
    return { code: e?.exitCode ?? 1, stdout: e?.stdout ?? '', stderr: e?.stderr ?? String(e), cwd: runCwd };
  } finally {
    if (opts.copyCwd && runCwd && runCwd.startsWith(os.tmpdir())) {
      await fs.remove(runCwd).catch(() => {});
    }
  }
}
