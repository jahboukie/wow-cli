import { evaluateProject } from '../core/evaluator.js';
import { loadPolicy, resolveCommandPolicy } from '../core/policy.js';

export async function evalCommand(opts: { json?: boolean; minScore?: number } = {}) {
  const policy = await loadPolicy();
  const p = resolveCommandPolicy(policy, 'eval');
  const evalSummary = await evaluateProject();
  if (opts.json) {
    console.log(JSON.stringify({ evaluator: evalSummary }));
  } else {
    console.log(`Evaluator score: ${evalSummary.score} (build=${evalSummary.build.code}, test=${evalSummary.test.code}${evalSummary.lint ? `, lint=${evalSummary.lint.code}${evalSummary.lint.skipped ? ' (skipped)' : ''}` : ''})`);
  }
  const minScore = opts.minScore ?? p.minScore ?? policy.minScore;
  if (typeof minScore === 'number' && evalSummary.score < minScore) {
    console.error(`Evaluator score ${evalSummary.score} is below threshold ${minScore}`);
    process.exitCode = 1;
  }
}
