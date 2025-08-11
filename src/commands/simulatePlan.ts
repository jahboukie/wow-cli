import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { Plan } from '../core/planner.js';
import { execute } from '../core/executor.js';
import { evaluateProject, computeConfidence } from '../core/evaluator.js';

export async function simulatePlanCommand(kind: 'fix-build'|'add-feature'|'clean', opts: { desc?: string; json?: boolean; minConfidence?: number } = {}) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wow-sim-'));
  const toCopy = ['src', 'tests', 'package.json', 'tsconfig.json', 'eslint.config.js'];
  for (const item of toCopy) {
    const p = path.join(process.cwd(), item);
    if (await fs.pathExists(p)) await fs.copy(p, path.join(tmp, item), { dereference: true });
  }
  const { planFixBuild, planAddFeature, planClean } = await import('../core/planner.js');
  const plan: Plan = kind === 'fix-build' ? await planFixBuild() : kind === 'add-feature' ? await planAddFeature(opts.desc || 'sim') : await planClean();
  const oldCwd = process.cwd();
  try {
    process.chdir(tmp);
    await execute(plan, { branchPrefix: 'sim' });
    const metrics = await evaluateProject(tmp);
    const confidence = computeConfidence(metrics);
    const out = { ok: true, confidence, evaluator: metrics };
    if (opts.json) console.log(JSON.stringify(out)); else console.log(`confidence=${confidence}`);
    if (typeof opts.minConfidence === 'number' && confidence < opts.minConfidence) process.exitCode = 1;
  } finally {
    process.chdir(oldCwd);
    await fs.remove(tmp).catch(() => {});
  }
}
