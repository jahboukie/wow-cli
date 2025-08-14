import { EvalMetrics } from './evaluator.js';

export function buildAdvice(metrics: EvalMetrics, confidence?: number) {
  const advice: string[] = [];
  if (metrics.build.skipped) advice.push('Add a build script (scripts.build) to unlock +15 points.');
  if (metrics.test.skipped) advice.push('Add a test script and at least one test file for +30 points.');
  if (metrics.lint && !metrics.lint.skipped && metrics.lint.code !== 0) advice.push('Run wow clean or configure ESLint to gain +10 points.');
  if (typeof confidence === 'number' && confidence < 50) advice.push('Confidence <50: run wow verify then wow fix-build or wow add-feature to raise health.');
  const nextStep = advice[0] || (metrics.build.code !== 0 ? 'Run wow fix-build' : metrics.test.code !== 0 ? 'Add or fix tests' : 'Proceed with feature work (wow add-feature)');
  return { advice, nextStep };
}
