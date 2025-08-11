import { evaluateProject } from '../core/evaluator.js';

export async function evalCommand(opts: { json?: boolean; minScore?: number } = {}) {
  const evalSummary = await evaluateProject();
  if (opts.json) {
    console.log(JSON.stringify({ evaluator: evalSummary }));
  } else {
    console.log(`Evaluator score: ${evalSummary.score} (build=${evalSummary.build.code}, test=${evalSummary.test.code}${evalSummary.lint ? `, lint=${evalSummary.lint.code}${evalSummary.lint.skipped ? ' (skipped)' : ''}` : ''})`);
  }
  if (typeof opts.minScore === 'number' && evalSummary.score < opts.minScore) {
    console.error(`Evaluator score ${evalSummary.score} is below threshold ${opts.minScore}`);
    process.exitCode = 1;
  }
}
