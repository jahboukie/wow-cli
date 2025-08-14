import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import { Plan } from './planner.js';
import { logEvent } from './ledger.js';
import { newBranch, stageAll, commitAll } from './git.js';
import { synthTestForJsModule } from './testsynth.js';

let lastError: string | undefined;

export async function execute(plan: Plan, opts: { branchPrefix?: string; muteRunOutput?: boolean } = {}) {
  const branch = await newBranch(opts.branchPrefix || plan.kind);
  await logEvent('git.branch', { branch, kind: plan.kind });

  for (const node of plan.nodes) {
    if (node.action === 'run') {
      const cmd = node.data?.cmd as string;
      const start = Date.now();
      try {
        const child = execa(cmd, { shell: true, stdout: opts.muteRunOutput ? 'pipe' : 'inherit', stderr: opts.muteRunOutput ? 'pipe' : 'inherit' });
        const res = await child;
        await logEvent('run', { cmd, code: res.exitCode ?? 0, ms: Date.now() - start });
        lastError = undefined;
      } catch (err: any) {
        await logEvent('error', { cmd, code: err.exitCode ?? 1 });
        lastError = err.stderr || err.stdout || err.message;
        // keep going; planner may intend interactive iteration
      }
    } else if (node.action === 'write') {
      const file = path.join(process.cwd(), node.data?.file);
      await fs.ensureDir(path.dirname(file));
      await fs.writeFile(file, node.data?.content ?? '', 'utf-8');
      await logEvent('info', { msg: 'write', file });
      // synthesize a basic test for JS/TS modules
      if (file.endsWith('.js')) {
        const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
        const created = await synthTestForJsModule(rel);
        if (created) await logEvent('info', { msg: 'testsynth.create', test: created });
      }
      await stageAll();
      await commitAll(node.data?.message || 'update files');
    } else if (node.action === 'apply_patch') {
      // reserved for future: in this MVP we rely on the wow apply command
      await logEvent('info', { msg: 'apply_patch node (noop in executor MVP)' });
    } else if (node.action === 'info') {
      await logEvent('info', { msg: node.data?.msg || '' });
    } else if (node.action === 'triage') {
      if (node.data?.query === 'last_error' && lastError) {
        console.log('\n--- Triage: Searching for context on last error ---');
        
        // New logic to find a better query from the error string
        const errorLines = lastError.split(/\r?\n/).filter(l => l.trim());
        let query = errorLines.find(l => /error:/i.test(l)) || errorLines[0] || lastError;
        query = query.trim().slice(0, 200);

        await logEvent('info', { msg: 'triage.start', query });
        try {
          // Note: Assumes `agm` is in the PATH.
          const child = execa('agm', ['search-code', query], { stdout: 'pipe', stderr: 'pipe' });
          child.stdout?.pipe(process.stdout);
          child.stderr?.pipe(process.stderr);
          await child;
          await logEvent('info', { msg: 'triage.end' });
        } catch (e: any) {
          await logEvent('error', { msg: 'triage.failed', error: e.message });
          console.error('Triage failed. Is `agm` installed and in your PATH?');
        }
        console.log('--- End Triage ---\n');
      }
    }
  }
}
