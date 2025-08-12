import { execa } from 'execa';
import { logEvent } from '../core/ledger.js';

export interface ShipOptions {
  json?: boolean;
  dryRun?: boolean;
  autoCommit?: string; // commit message if uncommitted changes
  noPr?: boolean;
  noMerge?: boolean;
  deleteBranch?: boolean;
  strategy?: 'squash' | 'merge' | 'rebase';
}

function out(msg: string, opts: ShipOptions) {
  if (!opts.json) console.log(msg);
}

async function run(cmd: string, opts: ShipOptions, allowFail = false) {
  if (opts.dryRun) return { cmd, skipped: true, code: 0 };
  try {
    const res = await (await import('execa')).execa(cmd, { shell: true });
    return { cmd, code: res.exitCode ?? 0 };
  } catch (e: any) {
    if (allowFail) return { cmd, code: e?.exitCode ?? 1, error: e?.stderr || String(e) };
    throw e;
  }
}

export async function shipCommand(opts: ShipOptions = {}) {
  const steps: any[] = [];
  const started = Date.now();
  await logEvent('info', { msg: 'ship.start' });
  // Determine current branch
  const branchRes = await (await import('execa')).execa('git rev-parse --abbrev-ref HEAD', { shell: true });
  const branch = branchRes.stdout.trim();
  if (branch === 'main' || branch === 'master') {
    const msg = 'Refusing to ship from primary branch; create a feature branch first.';
    if (opts.json) { console.log(JSON.stringify({ ok: false, error: msg })); return; }
    console.log(msg); return;
  }
  // Detect uncommitted changes
  const status = await (await import('execa')).execa('git status --porcelain', { shell: true });
  const dirty = status.stdout.trim().length > 0;
  if (dirty && opts.autoCommit) {
    steps.push({ action: 'autoCommit', message: opts.autoCommit });
    out(`Auto committing changes: "${opts.autoCommit}"`, opts);
    if (!opts.dryRun) {
      await (await import('execa')).execa('git add .', { shell: true });
      await (await import('execa')).execa(`git commit -m "${opts.autoCommit.replace(/"/g,'\\"')}"`, { shell: true });
    }
  } else if (dirty) {
    const msg = 'Working tree has uncommitted changes; pass --auto-commit "msg" to commit them.';
    if (opts.json) { console.log(JSON.stringify({ ok: false, error: msg })); return; }
    console.log(msg); return;
  }

  // Local pre-flight verify (build/test/lint)
  let verifyPayload: any = null;
  try {
    const verify = await (await import('execa')).execa('node dist/cli.js verify --json', { shell: true });
    try { verifyPayload = JSON.parse(verify.stdout); } catch {}
    steps.push({ action: 'verify', score: verifyPayload?.evaluator?.score });
    out(`Verified locally (score=${verifyPayload?.evaluator?.score})`, opts);
  } catch (e: any) {
    const msg = 'Local verify failed; aborting ship.';
    if (opts.json) { console.log(JSON.stringify({ ok: false, error: msg })); return; }
    console.log(msg); return;
  }

  // Push branch
  steps.push({ action: 'push', branch });
  out(`Pushing branch ${branch}`, opts);
  await run(`git push -u origin ${branch}`, opts);

  let prUrl: string | undefined;
  if (!opts.noPr) {
    // See if gh CLI is available
    const ghCheck = await run('gh --version', opts, true);
    if (ghCheck.code === 0) {
      steps.push({ action: 'pr.create' });
      out('Creating pull request via gh CLI', opts);
      const title = `feat(${branch}): ship`;
      const cmd = `gh pr create --base main --head ${branch} --title "${title}" --body "Automated ship from wow ship command."`;
      const prRes = await run(cmd, opts, true);
      if (prRes.code === 0 && !opts.dryRun) {
        // Attempt to read URL
        try {
          const view = await (await import('execa')).execa(`gh pr view --json url --jq .url`, { shell: true });
          prUrl = view.stdout.trim();
        } catch {}
      }
    } else {
      steps.push({ action: 'pr.skip', reason: 'gh CLI missing' });
      out('Skipping PR creation (gh CLI not found).', opts);
    }
  }

  // Merge if requested and PR exists
  if (!opts.noMerge && !opts.dryRun && prUrl) {
    steps.push({ action: 'pr.merge', strategy: opts.strategy || 'squash' });
    out('Merging pull request (no wait for checks)', opts);
    await run(`gh pr merge --${opts.strategy || 'squash'} --delete-branch --auto`, opts, true);
  } else if (opts.noMerge) {
    steps.push({ action: 'merge.skip' });
  }

  const result = { ok: true, branch, prUrl, steps, durationMs: Date.now() - started };
  await logEvent('info', { msg: 'ship.end', branch, prUrl });
  if (opts.json) console.log(JSON.stringify(result));
  else {
    out(`Ship complete${prUrl ? ' PR: '+prUrl : ''}`, opts);
  }
  return result;
}
