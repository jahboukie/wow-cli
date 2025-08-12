import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import { Plan } from './planner.js';
import { logEvent } from './ledger.js';
import { newBranch, stageAll, commitAll } from './git.js';
import { synthTestForJsModule } from './testsynth.js';

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
      } catch (err: any) {
        await logEvent('error', { cmd, code: err.exitCode ?? 1 });
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
    }
  }
}
