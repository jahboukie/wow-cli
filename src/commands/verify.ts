import { evaluateProject } from '../core/evaluator.js';
import { buildIndex } from '../core/indexer.js';
import { logEvent } from '../core/ledger.js';
import { buildAdvice } from '../core/advice.js';
import { loadState, saveState } from '../core/state.js';

export async function verifyCommand(opts: { json?: boolean; story?: boolean; report?: string; adviceLimit?: number } = {}) {
  await logEvent('info', { msg: 'phase.start', phase: 'verify:index' });
  await buildIndex();
  await logEvent('info', { msg: 'phase.end', phase: 'verify:index' });
  await logEvent('info', { msg: 'phase.start', phase: 'verify:evaluate' });
  const evalSummary = await evaluateProject();
  await logEvent('info', { msg: 'phase.end', phase: 'verify:evaluate', score: evalSummary.score });
  const health = {
    build: evalSummary.build.code === 0 ? 'ok' : 'fail',
    test: evalSummary.test.code === 0 ? 'ok' : 'fail',
    lint: evalSummary.lint?.skipped ? 'skipped' : (evalSummary.lint?.code === 0 ? 'ok' : 'fail'),
    score: evalSummary.score,
  };
  const warnings: string[] = [];
  if (evalSummary.lint && !evalSummary.lint.skipped && evalSummary.lint.code !== 0) warnings.push('lint issues detected (may reduce score after repeated failures)');
  const state = await loadState();
  const { advice, nextStep } = buildAdvice(evalSummary);
  const limitedAdvice = opts.adviceLimit ? advice.slice(0, opts.adviceLimit) : advice;
  if (opts.json) {
  const payload: any = { ok: true, verify: health, evaluator: evalSummary, warnings, advice: limitedAdvice, nextStep };
  if (evalSummary.penaltyApplied) payload.lintPenalty = { points: evalSummary.penaltyPoints, originalScore: evalSummary.originalScore };
  if (evalSummary.scoreBreakdown) payload.scoreBreakdown = evalSummary.scoreBreakdown;
    if (typeof state.lastScore === 'number') payload.scoreDelta = evalSummary.score - state.lastScore;
    const currentConf = Math.round(Math.min(100, (evalSummary.score / evalSummary.maxScore) * 100));
    if (typeof state.lastConfidence === 'number') payload.confidenceDelta = currentConf - state.lastConfidence;
    console.log(JSON.stringify(payload));
  } else {
    if (opts.report === 'md') {
      const lines: string[] = [];
      lines.push(`# Project Health Report`);
      lines.push('');
      lines.push(`**Build:** ${health.build}  `);
      lines.push(`**Test:** ${health.test}  `);
      lines.push(`**Lint:** ${health.lint}${warnings.length ? ' (warning)' : ''}  `);
  lines.push(`**Score:** ${health.score}/${evalSummary.maxScore}`);
  if (evalSummary.penaltyApplied) lines.push(`**Adaptive Penalty:** -${evalSummary.penaltyPoints} (original ${evalSummary.originalScore})`);
  if (evalSummary.scoreBreakdown) lines.push(`**Breakdown:** build ${evalSummary.scoreBreakdown.build}, test ${evalSummary.scoreBreakdown.test}, lint ${evalSummary.scoreBreakdown.lint}, penalty ${evalSummary.scoreBreakdown.penalty}`);
      if (typeof state.lastScore === 'number') lines.push(`**Score Δ:** ${health.score - state.lastScore}`);
      const currentConf = Math.round(Math.min(100, (evalSummary.score / evalSummary.maxScore) * 100));
      if (typeof state.lastConfidence === 'number') lines.push(`**Confidence Δ:** ${currentConf - state.lastConfidence}`);
      if (warnings.length) {
        lines.push('\n### Warnings');
        warnings.forEach(w => lines.push(`- ${w}`));
      }
      if (limitedAdvice.length) {
        lines.push('\n### Advice');
        limitedAdvice.forEach(a => lines.push(`- ${a}`));
      }
      lines.push('\n### Next Step');
      lines.push(nextStep);
      console.log(lines.join('\n'));
    } else if (opts.story) {
      const lines: string[] = [];
  lines.push(`Project health: build=${health.build}, test=${health.test}, lint=${health.lint}, score=${health.score}/${evalSummary.maxScore}.`);
  if (evalSummary.penaltyApplied) lines.push(`Adaptive lint penalty applied: -${evalSummary.penaltyPoints} (original ${evalSummary.originalScore})`);
  if (evalSummary.scoreBreakdown) lines.push(`Breakdown: build ${evalSummary.scoreBreakdown.build}, test ${evalSummary.scoreBreakdown.test}, lint ${evalSummary.scoreBreakdown.lint}, penalty ${evalSummary.scoreBreakdown.penalty}`);
      if (typeof state.lastScore === 'number') lines.push(`Score delta since last verify: ${health.score - state.lastScore}`);
      const currentConf = Math.round(Math.min(100, (evalSummary.score / evalSummary.maxScore) * 100));
      if (typeof state.lastConfidence === 'number') lines.push(`Confidence delta: ${currentConf - state.lastConfidence}`);
      if (warnings.length) lines.push(`Warnings: ${warnings.join('; ')}`);
      if (limitedAdvice.length) lines.push('Advice: ' + limitedAdvice.slice(0,3).join(' | '));
      lines.push(`Next: ${nextStep}`);
      console.log(lines.join('\n'));
    } else {
      console.log('verify summary:');
      console.log(` build: ${health.build}`);
      console.log(` test: ${health.test}`);
      console.log(` lint: ${health.lint}${warnings.length ? ' (warning)' : ''}`);
      console.log(` score: ${health.score}`);
      if (limitedAdvice.length) {
        console.log('Advice:');
        limitedAdvice.slice(0,3).forEach(a => console.log(` - ${a}`));
      }
      console.log(`Next: ${nextStep}`);
      warnings.forEach(w => console.log(` warning: ${w}`));
    }
  }
  const currentConfidence = Math.round(Math.min(100, (evalSummary.score / evalSummary.maxScore) * 100));
  await saveState({ lastScore: evalSummary.score, lastConfidence: currentConfidence });
  if (health.build !== 'ok' || health.test !== 'ok') process.exitCode = 1;
}
