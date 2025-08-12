import { execa } from 'execa';
import { logEvent } from '../core/ledger.js';

export async function autofixCommand(opts: { json?: boolean } = {}) {
  const steps: { step: string; ok: boolean }[] = [];
  async function run(label: string, cmd: string) {
    try {
      await execa(cmd, { shell: true, stdio: 'inherit' });
      steps.push({ step: label, ok: true });
    } catch {
      steps.push({ step: label, ok: false });
    }
  }
  await logEvent('info', { msg: 'autofix.start' });
  await run('build', 'npm run -s build');
  await run('lint-fix', 'npm run -s lint -- --fix');
  await logEvent('info', { msg: 'autofix.end', steps });
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, steps }));
  } else {
    console.log('autofix summary:');
    for (const s of steps) console.log(` - ${s.step}: ${s.ok ? 'ok' : 'skipped/fail'}`);
  }
}
