#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { applyCommand } from './commands/apply.js';
import { ledgerCommand } from './commands/ledger.js';
import { indexCommand } from './commands/index.js';
import { searchCommand } from './commands/search.js';
import { fixBuildCommand } from './commands/fixBuild.js';
import { addFeatureCommand } from './commands/addFeature.js';
import { cleanCommand } from './commands/clean.js';

const program = new Command();
program.name('wow').description('AI-native coding toolbox (MVP)').version('0.1.0');

program.command('init').description('Initialize .wow and verify git').option('--json', 'JSON output').action(initCommand);

program
  .command('run')
  .description('Run a shell command with ledger logging')
  .argument('<cmd...>', 'Command to run')
  .option('--json', 'JSON output')
  .action(async (cmd: string[], opts: any) => {
    await runCommand(cmd.join(' '), opts);
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
  .command('add-feature')
  .description('Scaffold a small feature')
  .argument('[description...]', 'Short feature description')
  .option('--json', 'JSON output')
  .option('--min-score <n>', 'Minimum evaluator score required', (v) => parseInt(v, 10))
  .action((desc: string[], opts: any) => addFeatureCommand((desc || []).join(' ').trim(), opts));

program
  .command('clean')
  .description('Run a cleanup/linting routine')
  .option('--json', 'JSON output')
  .option('--min-score <n>', 'Minimum evaluator score required', (v) => parseInt(v, 10))
  .action((opts: any) => cleanCommand(opts));

program.parseAsync(process.argv);
