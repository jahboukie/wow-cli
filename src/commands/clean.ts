import { planClean } from '../core/planner.js';
import { execute } from '../core/executor.js';
import { evaluateProject } from '../core/evaluator.js';
import { buildIndex } from '../core/indexer.js';
import { loadPolicy, resolveCommandPolicy } from '../core/policy.js';
import { simulatePlanCommand } from './simulatePlan.js';
import { logEvent } from '../core/ledger.js';

export async function cleanCommand(opts: { json?: boolean; minScore?: number } = {}) {
  const policy = await loadPolicy();
  const p = resolveCommandPolicy(policy, 'clean');
  const minConfidence = policy.minConfidence ?? p.minConfidence;
  if (p.simulateFirst && typeof minConfidence === 'number') {
    await simulatePlanCommand('clean', { json: opts.json, minConfidence });
    if (process.exitCode === 1) return;
  }
  await buildIndex();
  await logEvent('info', { msg: 'phase.start', phase: 'plan' });
  const plan = await planClean();
  await logEvent('info', { msg: 'phase.end', phase: 'plan', nodes: plan.nodes.length });
  await logEvent('info', { msg: 'phase.start', phase: 'execute' });
  await execute(plan, { branchPrefix: 'chore' });
  await logEvent('info', { msg: 'phase.end', phase: 'execute' });
  await logEvent('info', { msg: 'phase.start', phase: 'evaluate' });
  const evalSummary = await evaluateProject();
  await logEvent('info', { msg: 'phase.end', phase: 'evaluate', score: evalSummary.score });
  if (opts.json) {
    console.log(JSON.stringify({ evaluator: evalSummary }));
  } else {
    console.log(`Evaluator score: ${evalSummary.score} (build=${evalSummary.build.code}, test=${evalSummary.test.code})`);
    console.log('Clean plan executed.');
  }
  const minScore = opts.minScore ?? p.minScore ?? policy.minScore;
  if (typeof minScore === 'number' && evalSummary.score < minScore) {
    console.error(`Evaluator score ${evalSummary.score} is below threshold ${minScore}`);
    process.exitCode = 1;
  }
}
