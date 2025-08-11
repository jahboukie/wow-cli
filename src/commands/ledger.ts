import fs from 'fs-extra';
import path from 'path';
import { tailLedger } from '../core/ledger.js';

export async function ledgerCommand(opts: { tail?: boolean; json?: boolean }) {
  const file = path.join(process.cwd(), '.wow', 'ledger.ndjson');
  if (opts.tail) {
    await tailLedger((l) => console.log(l));
  } else {
    if (!(await fs.pathExists(file))) {
      if (opts.json) console.log(JSON.stringify({ ok: true, lines: 0 }));
      else console.log('No ledger yet.');
      return;
    }
    const text = await fs.readFile(file, 'utf-8');
    const lines = text.trim() ? text.trim().split('\n') : [];
  if (opts.json) console.log(JSON.stringify({ ok: true, lines: lines.length, entries: lines }));
  else lines.forEach((l: any) => console.log(l));
  }
}
