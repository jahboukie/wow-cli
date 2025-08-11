import fs from 'fs-extra';
import path from 'path';

export type EventKind = 'info' | 'run' | 'git.apply' | 'git.branch' | 'git.commit' | 'watchdog' | 'error';

export async function logEvent(kind: EventKind, data: any) {
  const line = JSON.stringify({ ts: new Date().toISOString(), kind, data }) + '\n';
  const file = path.join(process.cwd(), '.wow', 'ledger.ndjson');
  await fs.appendFile(file, line, 'utf-8');
}

export async function tailLedger(onLine: (l: string) => void) {
  const file = path.join(process.cwd(), '.wow', 'ledger.ndjson');
  await fs.ensureFile(file);
  const stream = fs.createReadStream(file, { encoding: 'utf-8' });
  let buf = '';
  for await (const chunk of stream as any) {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line.trim()) onLine(line);
    }
  }
}
