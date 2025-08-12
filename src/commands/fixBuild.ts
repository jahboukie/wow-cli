import { planFixBuild } from '../core/planner.js';
import { execute } from '../core/executor.js';
import { buildIndex } from '../core/indexer.js';
import { evaluateProject } from '../core/evaluator.js';
import { loadPolicy, resolveCommandPolicy } from '../core/policy.js';
import { simulatePlanCommand } from './simulatePlan.js';

export async function fixBuildCommand(opts: { json?: boolean; minScore?: number } = {}) {
  // policy-driven simulate-first gate
  const policy = await loadPolicy();
  const p = resolveCommandPolicy(policy, 'fix-build');
  const minConfidence = policy.minConfidence ?? p.minConfidence;
  if (p.simulateFirst && typeof minConfidence === 'number') {
    await simulatePlanCommand('fix-build', { json: opts.json, minConfidence });
    if (process.exitCode === 1) return;
  }
  await buildIndex();
  const plan = await planFixBuild();
  await execute(plan, { branchPrefix: 'fix' });
  const evalSummary = await evaluateProject();
  if (opts.json) {
    console.log(JSON.stringify({ evaluator: evalSummary }));
  } else {
    console.log(`Evaluator score: ${evalSummary.score} (build=${evalSummary.build.code}, test=${evalSummary.test.code})`);
  }
  const minScore = opts.minScore ?? p.minScore ?? policy.minScore;
  if (typeof minScore === 'number' && evalSummary.score < minScore) {
    console.error(`Evaluator score ${evalSummary.score} is below threshold ${minScore}`);
    process.exitCode = 1;
    return;
  }
  if (!opts.json) {
    console.log('Fix-build plan executed. Review test output and use wow apply for patches.');
  }
}
