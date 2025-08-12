import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import { Plan } from '../core/planner.js';
import { execute } from '../core/executor.js';
import { evaluateProject, computeConfidence } from '../core/evaluator.js';

type SimOpts = { desc?: string; json?: boolean; minConfidence?: number; preview?: boolean; patch?: boolean; summaryOnly?: boolean };

async function initBaselineRepo(cwd: string): Promise<void> {
  try {
    await execa('git', ['init'], { cwd });
    await execa('git', ['config', 'user.email', 'wow@example.local'], { cwd });
    await execa('git', ['config', 'user.name', 'wow-sim'], { cwd });
    await execa('git', ['add', '-A'], { cwd });
    await execa('git', ['commit', '--allow-empty', '-m', 'baseline'], { cwd });
  } catch {
    // ignore baseline failures; preview will be empty
  }
}

async function computeSummaryPatch(cwd: string, includePatch: boolean): Promise<{ summary: any[]; patch?: string }> {
  try {
    // Stage all changes so we can capture added files and deletions
    await execa('git', ['add', '-A'], { cwd });
    const { stdout: nameStatus } = await execa('git', ['diff', '--cached', '--name-status'], { cwd });
    const rawSummary = nameStatus
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [status, ...rest] = line.trim().split(/\s+/);
        const file = rest.join(' ');
        return { status, file };
      });
    const summary = rawSummary.filter((s) => !(
      s.file.startsWith('.wow/') ||
      s.file.startsWith('dist/') ||
      s.file.startsWith('node_modules/') ||
      s.file.startsWith('.git/')
    ));
    let patch: string | undefined;
    if (includePatch) {
      const { stdout } = await execa('git', ['--no-pager', 'diff', '--cached', '--unified=3'], { cwd });
      patch = stdout;
    }
    return { summary, patch };
  } catch {
    // Fallback: simple filesystem walk comparing mtimes & sizes across a baseline copy isn't available here; return empty.
    return { summary: [], patch: undefined };
  }
}

export async function simulatePlanCommand(kind: 'fix-build'|'add-feature'|'clean', opts: SimOpts = {}) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wow-sim-'));
  const toCopy = ['src', 'tests', 'package.json', 'tsconfig.json', 'eslint.config.js'];
  for (const item of toCopy) {
    const p = path.join(process.cwd(), item);
    if (await fs.pathExists(p)) await fs.copy(p, path.join(tmp, item), { dereference: true });
  }
  const { planFixBuild, planAddFeature, planClean } = await import('../core/planner.js');
  const plan: Plan = kind === 'fix-build' ? await planFixBuild() : kind === 'add-feature' ? await planAddFeature(opts.desc || 'sim') : await planClean();
  const oldCwd = process.cwd();
  try {
    process.chdir(tmp);
    // Initialize git baseline if preview requested
  if (opts.preview || opts.patch) await initBaselineRepo(tmp);
  await execute(plan, { branchPrefix: 'sim', muteRunOutput: !!opts.summaryOnly });
    let metrics: any | undefined;
    let confidence: number | undefined;
    if (!opts.summaryOnly) {
      metrics = await evaluateProject(tmp);
      confidence = computeConfidence(metrics);
    }
    let summary: any[] | undefined;
    let patch: string | undefined;
    if (opts.preview || opts.patch) {
      const diffRes = await computeSummaryPatch(tmp, !!opts.patch);
      summary = diffRes.summary;
      patch = diffRes.patch;
    }
    const out: any = { ok: true };
    if (!opts.summaryOnly) {
      out.confidence = confidence;
      out.evaluator = metrics;
    }
    if (summary && summary.length) out.summary = summary;
    if (opts.patch && patch) out.patch = patch;
    if (opts.json) {
      console.log(JSON.stringify(out));
    } else {
  if (!opts.summaryOnly) console.log(`confidence=${confidence}`);
      if (summary && summary.length) {
        console.log('Changes:');
        for (const s of summary) console.log(` ${s.status} ${s.file}`);
      }
      if (opts.patch && patch) {
        console.log('--- patch ---');
        console.log(patch);
      }
    }
  if (!opts.summaryOnly && typeof opts.minConfidence === 'number' && typeof confidence === 'number' && confidence < opts.minConfidence) process.exitCode = 1;
  } finally {
    process.chdir(oldCwd);
    await fs.remove(tmp).catch(() => {});
  }
}
