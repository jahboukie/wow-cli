import { planFixBuild } from '../core/planner.js';
import { execute } from '../core/executor.js';
import { buildIndex } from '../core/indexer.js';
import { evaluateProject } from '../core/evaluator.js';

export async function fixBuildCommand(opts: { json?: boolean; minScore?: number } = {}) {
  await buildIndex();
  const plan = await planFixBuild();
  await execute(plan, { branchPrefix: 'fix' });
  const evalSummary = await evaluateProject();
  if (opts.json) {
    console.log(JSON.stringify({ evaluator: evalSummary }));
  } else {
    console.log(`Evaluator score: ${evalSummary.score} (build=${evalSummary.build.code}, test=${evalSummary.test.code})`);
  }
  if (typeof opts.minScore === 'number' && evalSummary.score < opts.minScore) {
    console.error(`Evaluator score ${evalSummary.score} is below threshold ${opts.minScore}`);
    process.exitCode = 1;
    return;
  }
  if (!opts.json) {
    console.log('Fix-build plan executed. Review test output and use wow apply for patches.');
  }
}
