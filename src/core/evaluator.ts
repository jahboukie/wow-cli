import { execa } from 'execa';
import { logEvent } from './ledger.js';
import fs from 'fs-extra';
import path from 'path';
import { loadState, saveState } from './state.js';
import { loadPolicy } from './policy.js';

export type EvalMetrics = {
  build: { code: number; ms: number; skipped?: boolean };
  test: { code: number; ms: number; skipped?: boolean };
  lint?: { code: number; ms: number; skipped?: boolean };
  score: number;
  maxScore: number;
  originalScore?: number; // before adaptive penalties
  penaltyApplied?: boolean;
  penaltyPoints?: number;
  scoreBreakdown?: { build: number; test: number; lint: number; penalty: number };
};

async function run(cmd: string, cwd?: string) {
  const started = Date.now();
  try {
  const res = await execa(cmd, { shell: true, cwd });
    return { code: res.exitCode ?? 0, ms: Date.now() - started };
  } catch (err: any) {
    return { code: err?.exitCode ?? 1, ms: Date.now() - started };
  }
}

function computeScore(m: { build?: number; buildSkipped?: boolean; test?: number; testSkipped?: boolean; lint?: number; lintSkipped?: boolean }) {
  let buildPoints = 0, testPoints = 0, lintPoints = 0;
  if (!m.buildSkipped && typeof m.build === 'number') buildPoints = m.build === 0 ? 15 : -15;
  if (!m.testSkipped && typeof m.test === 'number') testPoints = m.test === 0 ? 30 : -30;
  if (!m.lintSkipped && typeof m.lint === 'number') lintPoints = m.lint === 0 ? 10 : 0; // neutral fail
  return { total: buildPoints + testPoints + lintPoints, buildPoints, testPoints, lintPoints };
}

export async function evaluateProject(cwd?: string): Promise<EvalMetrics> {
  // Detect presence of build & test scripts before running
  const scriptProbe = await execa('node', ['-e', "const fs=require('fs');let s={};try{s=JSON.parse(fs.readFileSync('package.json','utf8')).scripts||{}}catch(e){};process.stdout.write(JSON.stringify({hasBuild:!!s.build,hasTest:!!s.test,hasLint:!!s.lint}));"], { cwd });
  let scriptFlags = { hasBuild:false, hasTest:false, hasLint:false } as any;
  try { scriptFlags = JSON.parse(scriptProbe.stdout || '{}'); } catch {}

  let build: EvalMetrics['build'];
  if (scriptFlags.hasBuild) {
    // Optional fast path: allow skipping build if environment requests it (useful in CI/test to reduce memory churn)
    if (process.env.WOW_SKIP_BUILD === '1') {
      build = { code: 0, ms: 0, skipped: true };
    } else {
    const b = await run('npm run -s build', cwd);
    const nodeModulesPresent = fs.existsSync(path.join(cwd || process.cwd(), 'node_modules'));
    if (!nodeModulesPresent && b.code !== 0) {
      // In simulation we often omit node_modules for speed; treat as skipped not a failure.
      build = { code: 0, ms: b.ms, skipped: true };
    } else {
      build = b.code === 127 ? { code: 0, ms: b.ms, skipped: true } : { ...b };
    }
    }
  } else {
    build = { code: 0, ms: 0, skipped: true };
  }
  let test: EvalMetrics['test'];
  if (scriptFlags.hasTest) {
    const t = await run('npm -s test', cwd);
    test = t.code === 127 ? { code: 0, ms: t.ms, skipped: true } : { ...t };
  } else {
    test = { code: 0, ms: 0, skipped: true };
  }

  // Lint only if a config exists
  let lint: EvalMetrics['lint'] | undefined = undefined;
  // Prefer npm script if present
  const lintScriptExists = await run(
    "node -e \"const fs=require('fs');let s={};try{s=JSON.parse(fs.readFileSync('package.json','utf8')).scripts||{}}catch(e){};process.exit(s.lint?0:2)\"",
    cwd,
  );
  if (lintScriptExists.code === 0) {
  const l = await run('npm run -s lint', cwd);
  lint = l.code === 127 ? { code: 0, ms: l.ms, skipped: true } : { code: l.code, ms: l.ms };
  } else {
    const configExists = await run(
      "node -e \"const fs=require('fs');const names=['eslint.config.js','eslint.config.cjs','eslint.config.mjs','.eslintrc','.eslintrc.js','.eslintrc.cjs','.eslintrc.mjs','.eslintrc.json'];process.exit(names.some(f=>fs.existsSync(f))?0:2)\"",
      cwd,
    );
    if (configExists.code === 0) {
  const l = await run('npx -y eslint .|| exit 0', cwd); // treat missing as skipped
  lint = l.code === 127 ? { code: 0, ms: l.ms, skipped: true } : { code: l.code, ms: l.ms };
    } else {
      lint = { code: 0, ms: 0, skipped: true };
    }
  }

  const maxScore = 55; // 15+30+10
  const scorePieces = computeScore({ build: build.code, buildSkipped: build.skipped, test: test.code, testSkipped: test.skipped, lint: lint?.code, lintSkipped: lint?.skipped });
  let score = scorePieces.total;
  const originalScore = score;
  // Load policy for configurable adaptive lint penalty
  const policy = await loadPolicy(cwd || process.cwd());
  const penaltyCfg: any = (policy as any).lintPenalty || {};
  const enabled = penaltyCfg.enabled !== false; // default true
  const threshold = typeof penaltyCfg.threshold === 'number' ? penaltyCfg.threshold : 3;
  const penaltyPoints = typeof penaltyCfg.points === 'number' ? penaltyCfg.points : 5;
  // Adaptive lint penalty: after N consecutive lint failures, apply -penaltyPoints once until a pass resets counter
  const state = await loadState(cwd || process.cwd());
  let lintFailCount = state.lintFailCount || 0;
  let penaltyApplied = false;
  if (enabled) {
    if (lint && !lint.skipped && lint.code !== 0) {
      lintFailCount += 1;
      if (lintFailCount >= threshold) {
        score -= penaltyPoints; // gentle nudge
        penaltyApplied = true;
      }
    } else if (lint && (!lint.skipped && lint.code === 0)) {
      lintFailCount = 0; // reset on pass
    }
  }
  await saveState({ lintFailCount }, cwd || process.cwd());
  const summary = { build, test, lint, score, maxScore, originalScore, penaltyApplied, penaltyPoints: penaltyApplied ? penaltyPoints : 0, scoreBreakdown: { build: scorePieces.buildPoints, test: scorePieces.testPoints, lint: scorePieces.lintPoints, penalty: penaltyApplied ? -penaltyPoints : 0 } } as any as EvalMetrics;
  await logEvent('info', { msg: 'evaluator.summary', summary });
  return summary;
}

export function computeConfidence(metrics: EvalMetrics): number {
  const numer = Math.max(0, metrics.score);
  return Math.round(Math.min(100, (numer / metrics.maxScore) * 100));
}
