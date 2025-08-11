import { planClean } from '../core/planner.js';
import { execute } from '../core/executor.js';
import { evaluateProject } from '../core/evaluator.js';
import { buildIndex } from '../core/indexer.js';

export async function cleanCommand(opts: { json?: boolean; minScore?: number } = {}) {
  await buildIndex();
  const plan = await planClean();
  await execute(plan, { branchPrefix: 'chore' });
  const evalSummary = await evaluateProject();
  if (opts.json) {
    console.log(JSON.stringify({ evaluator: evalSummary }));
  } else {
    console.log(`Evaluator score: ${evalSummary.score} (build=${evalSummary.build.code}, test=${evalSummary.test.code})`);
    console.log('Clean plan executed.');
  }
  if (typeof opts.minScore === 'number' && evalSummary.score < opts.minScore) {
    console.error(`Evaluator score ${evalSummary.score} is below threshold ${opts.minScore}`);
    process.exitCode = 1;
  }
}
