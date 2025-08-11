import { execa } from 'execa';
import { logEvent } from './ledger.js';

export type EvalMetrics = {
  build: { code: number; ms: number };
  test: { code: number; ms: number };
  lint?: { code: number; ms: number; skipped?: boolean };
  score: number;
};

async function run(cmd: string) {
  const started = Date.now();
  try {
    const res = await execa(cmd, { shell: true });
    return { code: res.exitCode ?? 0, ms: Date.now() - started };
  } catch (err: any) {
    return { code: err?.exitCode ?? 1, ms: Date.now() - started };
  }
}

function computeScore(m: { build: number; test: number; lint?: number; lintSkipped?: boolean }) {
  let score = 0;
  score += m.build === 0 ? 10 : -10;
  score += m.test === 0 ? 20 : -20;
  if (m.lintSkipped) {
    // neutral if skipped
  } else if (typeof m.lint === 'number') {
    score += m.lint === 0 ? 5 : -5;
  }
  return score;
}

export async function evaluateProject(): Promise<EvalMetrics> {
  // Always try build + test
  const build = await run('npm run -s build');
  const test = await run('npm -s test');

  // Lint only if a config exists
  let lint: EvalMetrics['lint'] | undefined = undefined;
  // Prefer npm script if present
  const lintScriptExists = await run(
    "node -e \"const fs=require('fs');let s={};try{s=JSON.parse(fs.readFileSync('package.json','utf8')).scripts||{}}catch(e){};process.exit(s.lint?0:2)\"",
  );
  if (lintScriptExists.code === 0) {
    const l = await run('npm run -s lint');
    lint = { code: l.code, ms: l.ms };
  } else {
    const configExists = await run(
      "node -e \"const fs=require('fs');const names=['eslint.config.js','eslint.config.cjs','eslint.config.mjs','.eslintrc','.eslintrc.js','.eslintrc.cjs','.eslintrc.mjs','.eslintrc.json'];process.exit(names.some(f=>fs.existsSync(f))?0:2)\"",
    );
    if (configExists.code === 0) {
      const l = await run('npx -y eslint .');
      lint = { code: l.code, ms: l.ms };
    } else {
      lint = { code: 0, ms: 0, skipped: true };
    }
  }

  const score = computeScore({ build: build.code, test: test.code, lint: lint?.code, lintSkipped: lint?.skipped });
  const summary = { build, test, lint, score } as EvalMetrics;
  await logEvent('info', { msg: 'evaluator.summary', summary });
  return summary;
}
