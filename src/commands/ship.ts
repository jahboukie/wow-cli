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
  allowDirty?: boolean; // proceed even if working tree (non-ephemeral) dirty
  waitChecks?: boolean; // wait for CI status checks before merge
  waitTimeoutMs?: number; // timeout for waiting
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
  // Determine current branch (avoid logging before cleanliness check since ledger write dirties tree)
  const branchRes = await (await import('execa')).execa('git rev-parse --abbrev-ref HEAD', { shell: true });
  const branch = branchRes.stdout.trim();
  if (branch === 'main' || branch === 'master') {
    const msg = 'Refusing to ship from primary branch; create a feature branch first.';
    if (opts.json) { console.log(JSON.stringify({ ok: false, error: msg })); return; }
    console.log(msg); return;
  }
  // Detect uncommitted changes (filter ephemeral .wow state & ledger files)
  const status = await (await import('execa')).execa('git status --porcelain', { shell: true });
  const EPHEMERAL = ['.wow/state.json', '.wow/ledger.ndjson', '.wow/index.json'];
  const dirtyFiles = status.stdout
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(l => l.slice(3))
    .filter(f => f && !EPHEMERAL.includes(f));
  const dirty = dirtyFiles.length > 0;
  if (dirty && opts.autoCommit) {
    steps.push({ action: 'autoCommit', message: opts.autoCommit });
    out(`Auto committing changes: "${opts.autoCommit}"`, opts);
    if (!opts.dryRun) {
      await (await import('execa')).execa('git add .', { shell: true });
      await (await import('execa')).execa(`git commit -m "${opts.autoCommit.replace(/"/g,'\\"')}"`, { shell: true });
    }
  } else if (dirty && !opts.allowDirty) {
    const msg = 'Working tree has uncommitted changes; pass --auto-commit "msg" to commit them.';
    if (opts.json) { console.log(JSON.stringify({ ok: false, error: msg })); return; }
    console.log(msg); return;
  }
  await logEvent('info', { msg: 'ship.start', branch });

  // Local pre-flight verify (build/test/lint)
  let verifyPayload: any = null;
  try {
    const verify = await (await import('execa')).execa('node dist/cli.js verify --json', { shell: true });
    try { verifyPayload = JSON.parse(verify.stdout); } catch {}
    steps.push({ action: 'verify', score: verifyPayload?.evaluator?.score });
    out(`Verified locally (score=${verifyPayload?.evaluator?.score})`, opts);
  } catch (e: any) {
    const msg = 'Local verify failed; aborting ship.';
    const fail = { ok: false, error: msg, steps, durationMs: Date.now() - started };
    if (opts.json) { console.log(JSON.stringify(fail)); return fail; }
    console.log(msg); return fail;
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

  // Optionally wait for status checks
  if (prUrl && opts.waitChecks && !opts.dryRun) {
    const startWait = Date.now();
    const timeout = opts.waitTimeoutMs ?? 10 * 60 * 1000;
    steps.push({ action: 'checks.wait.start', timeoutMs: timeout });
    out('Waiting for status checks to complete...', opts);
    let completed = false;
    while (!completed && Date.now() - startWait < timeout) {
      try {
        const view = await (await import('execa')).execa('gh pr view --json statusCheckRollup');
        const data = JSON.parse(view.stdout || '{}');
        const roll = data.statusCheckRollup || [];
        if (!Array.isArray(roll) || roll.length === 0) {
          // No checks -> treat as done
          completed = true;
          steps.push({ action: 'checks.none' });
          break;
        }
        const pending = roll.filter((c: any) => (c.status && c.status !== 'COMPLETED'));
        const failed = roll.filter((c: any) => (c.conclusion && c.conclusion !== 'SUCCESS'));
        if (failed.length) {
          steps.push({ action: 'checks.failed', failed: failed.map((f: any) => f.name) });
          out('Some checks failed; skipping auto merge.', opts);
          opts.noMerge = true; // prevent merge
          break;
        }
        if (pending.length === 0) {
          completed = true;
          steps.push({ action: 'checks.success' });
          out('All checks successful.', opts);
          break;
        }
      } catch (e: any) {
        // treat error as transient
        steps.push({ action: 'checks.poll.error', error: (e?.stderr || e?.message || '').slice(0,120) });
      }
      await new Promise(r => setTimeout(r, 5000));
    }
    if (!completed) {
      steps.push({ action: 'checks.timeout' });
      out('Timed out waiting for checks; skipping auto merge.', opts);
      opts.noMerge = true;
    }
  }

  // Merge if requested and PR exists (after optional checks)
  if (!opts.noMerge && !opts.dryRun && prUrl) {
    steps.push({ action: 'pr.merge', strategy: opts.strategy || 'squash' });
    out('Merging pull request', opts);
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
