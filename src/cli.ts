#!/usr/bin/env node
import { Command } from 'commander';
import { newRunId, getRunId } from './core/runContext.js';
import { logEvent } from './core/ledger.js';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { applyCommand } from './commands/apply.js';
import { ledgerCommand } from './commands/ledger.js';
import { indexCommand } from './commands/index.js';
import { searchCommand } from './commands/search.js';
import { fixBuildCommand } from './commands/fixBuild.js';
import { addFeatureCommand } from './commands/addFeature.js';
import { cleanCommand } from './commands/clean.js';
import { evalCommand } from './commands/eval.js';
import { simulateCommand } from './commands/simulate.js';
import { simulatePlanCommand } from './commands/simulatePlan.js';
import { explainCommand } from './commands/explain.js';
import { hookCommand, scanCommand } from './commands/hook.js';
import { listFeatures } from './core/entitlement.js';
import { verifyCommand } from './commands/verify.js';
import { autofixCommand } from './commands/autofix.js';
import { shipCommand } from './commands/ship.js';

const program = new Command();
program.name('wow').description('AI-native coding toolbox (MVP)').version('0.1.0');

program.command('init').description('Initialize .wow and verify git').option('--json', 'JSON output').action(initCommand);

program
  .command('run')
  .description('Run a shell command with ledger logging')
  .argument('<cmd...>', 'Command to run')
  .option('--json', 'JSON output')
  .option('--sandbox', 'Run in a soft sandbox (allowlist + temp copy)')
  .action(async (cmd: string[], opts: any) => {
  if (opts.sandbox) await runCommand(cmd, opts);
  else await runCommand(cmd.join(' '), opts);
  });

program
  .command('apply')
  .description('Apply a unified diff (stdin or --from-file), branch and commit')
  .option('--from-file <path>', 'Path to unified diff file')
  .option('-m, --message <msg>', 'Commit message', 'apply patch')
  .option('--json', 'JSON output')
  .action((opts: any) => applyCommand(opts));

program
  .command('ledger')
  .description('Print or tail the ledger')
  .option('--tail', 'Stream ledger as it grows')
  .option('--json', 'JSON output')
  .action(ledgerCommand);

program
  .command('index')
  .description('Build a local code index')
  .option('--json', 'JSON output')
  .action(indexCommand);

program
  .command('search')
  .description('Search the code index for a symbol name')
  .argument('<query>', 'substring to search for')
  .option('--json', 'JSON output')
  .action((q: string, opts: any) => searchCommand(q, opts));

program
  .command('fix-build')
  .description('Plan and run a basic fix-build routine')
  .option('--json', 'JSON output')
  .option('--min-score <n>', 'Minimum evaluator score required', (v) => parseInt(v, 10))
  .action((opts: any) => fixBuildCommand(opts));

program
  .command('simulate-fix-build')
  .description('Simulate fix-build plan in a temp workspace and report confidence')
  .option('--json', 'JSON output')
  .option('--preview', 'Show file change summary in simulation')
  .option('--patch', 'Include unified diff patch in output (may be large)')
  .option('--summary-only', 'Print only change summary/patch, skip evaluator/confidence')
  .option('--full-build', 'Run npm install in temp simulation for accurate build signal')
  .option('--advice-limit <n>', 'Limit number of advice items', (v)=>parseInt(v,10))
  .option('--min-confidence <n>', 'Minimum confidence required', (v) => parseInt(v, 10))
  .action((opts: any) => simulatePlanCommand('fix-build', { json: opts.json, minConfidence: opts.minConfidence, preview: opts.preview, patch: opts.patch, summaryOnly: opts.summaryOnly, fullBuild: opts.fullBuild, adviceLimit: opts.adviceLimit }));

program
  .command('add-feature')
  .description('Scaffold a small feature')
  .argument('[description...]', 'Short feature description')
  .option('--json', 'JSON output')
  .option('--min-score <n>', 'Minimum evaluator score required', (v) => parseInt(v, 10))
  .action((desc: string[], opts: any) => addFeatureCommand((desc || []).join(' ').trim(), opts));

program
  .command('simulate-add-feature')
  .description('Simulate add-feature plan in a temp workspace and report confidence')
  .argument('[description...]', 'Short feature description')
  .option('--json', 'JSON output')
  .option('--preview', 'Show file change summary in simulation')
  .option('--patch', 'Include unified diff patch in output (may be large)')
  .option('--summary-only', 'Print only change summary/patch, skip evaluator/confidence')
  .option('--full-build', 'Run npm install in temp simulation for accurate build signal')
  .option('--advice-limit <n>', 'Limit number of advice items', (v)=>parseInt(v,10))
  .option('--min-confidence <n>', 'Minimum confidence required', (v) => parseInt(v, 10))
  .action((desc: string[], opts: any) => simulatePlanCommand('add-feature', { desc: (desc||[]).join(' ').trim(), json: opts.json, minConfidence: opts.minConfidence, preview: opts.preview, patch: opts.patch, summaryOnly: opts.summaryOnly, fullBuild: opts.fullBuild, adviceLimit: opts.adviceLimit }));

program
  .command('clean')
  .description('Run a cleanup/linting routine')
  .option('--json', 'JSON output')
  .option('--min-score <n>', 'Minimum evaluator score required', (v) => parseInt(v, 10))
  .action((opts: any) => cleanCommand(opts));

program
  .command('simulate-clean')
  .description('Simulate clean plan in a temp workspace and report confidence')
  .option('--json', 'JSON output')
  .option('--preview', 'Show file change summary in simulation')
  .option('--patch', 'Include unified diff patch in output (may be large)')
  .option('--summary-only', 'Print only change summary/patch, skip evaluator/confidence')
  .option('--full-build', 'Run npm install in temp simulation for accurate build signal')
  .option('--advice-limit <n>', 'Limit number of advice items', (v)=>parseInt(v,10))
  .option('--min-confidence <n>', 'Minimum confidence required', (v) => parseInt(v, 10))
  .action((opts: any) => simulatePlanCommand('clean', { json: opts.json, minConfidence: opts.minConfidence, preview: opts.preview, patch: opts.patch, summaryOnly: opts.summaryOnly, fullBuild: opts.fullBuild, adviceLimit: opts.adviceLimit }));

program
  .command('eval')
  .description('Run the evaluator only')
  .option('--json', 'JSON output')
  .option('--min-score <n>', 'Minimum evaluator score required', (v) => parseInt(v, 10))
  .action((opts: any) => evalCommand(opts));

program
  .command('simulate')
  .description('Simulate an untrusted JS module in a restricted VM (exports async main)')
  .argument('<file>', 'Path to JS module')
  .option('--timeout <ms>', 'Timeout in milliseconds', (v) => parseInt(v, 10))
  .option('--json', 'JSON output')
  .action((file: string, opts: any) => simulateCommand(file, opts));

program
  .command('explain')
  .description('Explain the last run or a specific run id from the ledger')
  .argument('<which>', 'last|run|list')
  .option('--run <id>', 'Specific run id when using mode run')
  .option('--story', 'Narrative summary output (text)')
  .option('--json', 'JSON output')
  .action((which: string, opts: any) => explainCommand(which === 'run' ? 'run' : which === 'list' ? 'list' : 'last', { json: opts.json, run: opts.run, story: opts.story }));

program
  .command('hook')
  .description('Manage wow git hooks (pre-commit)')
  .argument('<sub>', 'install')
  .option('--json','JSON output')
  .action((sub: string, opts: any) => hookCommand(sub, opts));

program
  .command('scan')
  .description('Run secret/policy scan on staged diff')
  .option('--json','JSON output')
  .action((opts: any) => scanCommand(opts));

program
  .command('features')
  .description('Show current tier and feature availability')
  .option('--json','JSON output')
  .action((opts: any) => listFeatures(!opts.json ? true : false));

program
  .command('verify')
  .description('Aggregate project health (build/test/lint/score)')
  .option('--json','JSON output')
  .option('--story','Narrative health summary (text)')
  .option('--report <fmt>','Generate report (md)')
  .option('--advice-limit <n>','Limit number of advice items', (v)=>parseInt(v,10))
  .action((opts: any) => verifyCommand({ json: opts.json, story: opts.story, report: opts.report, adviceLimit: opts.adviceLimit }));

program
  .command('autofix')
  .description('Run lightweight automated fixes (build, lint --fix)')
  .option('--json','JSON output')
  .action((opts: any) => autofixCommand(opts));

program
  .command('ship')
  .description('Automate push + PR (gh) + optional merge for current feature branch')
  .option('--json','JSON output')
  .option('--dry-run','Print planned steps without executing')
  .option('--auto-commit <msg>','Automatically commit all changes with message before shipping')
  .option('--no-pr','Skip creating a pull request')
  .option('--no-merge','Do not attempt merge (always skip)')
  .option('--strategy <s>','Merge strategy (squash|merge|rebase)','squash')
  .option('--allow-dirty','Proceed even if non-ephemeral files are dirty (not recommended)')
  .action(async (opts: any) => { await shipCommand({ json: opts.json, dryRun: opts.dryRun, autoCommit: opts.autoCommit, noPr: opts.pr === false, noMerge: opts.merge === false, strategy: opts.strategy, allowDirty: opts.allowDirty }); });

async function main() {
  const rid = newRunId();
  await logEvent('info', { msg: 'run.start', argv: process.argv.slice(2), runId: rid });
  const started = Date.now();
  try {
    await program.parseAsync(process.argv);
  } finally {
    const dur = Date.now() - started;
    await logEvent('info', { msg: 'run.end', runId: getRunId(), durationMs: dur, exitCode: process.exitCode || 0 });
  }
}

main();
