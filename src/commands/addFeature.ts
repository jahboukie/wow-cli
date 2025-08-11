import { planAddFeature } from '../core/planner.js';
import { execute } from '../core/executor.js';
import { evaluateProject } from '../core/evaluator.js';

export async function addFeatureCommand(desc: string, opts: { json?: boolean; minScore?: number } = {}) {
  const plan = await planAddFeature(desc);
  await execute(plan, { branchPrefix: 'feat' });
  const evalSummary = await evaluateProject();
  if (opts.json) {
    console.log(JSON.stringify({ evaluator: evalSummary }));
  } else {
    console.log(`Evaluator score: ${evalSummary.score} (build=${evalSummary.build.code}, test=${evalSummary.test.code})`);
    console.log('Feature scaffolded.');
  }
  if (typeof opts.minScore === 'number' && evalSummary.score < opts.minScore) {
    console.error(`Evaluator score ${evalSummary.score} is below threshold ${opts.minScore}`);
    process.exitCode = 1;
  }
}
