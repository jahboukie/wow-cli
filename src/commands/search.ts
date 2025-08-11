import { searchIndex } from '../core/indexer.js';

export async function searchCommand(query: string, opts: { json?: boolean }) {
  if (!query) {
    const msg = 'Provide a search query, e.g., wow search health';
    if (opts?.json) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(msg);
    return;
  }
  const res = await searchIndex(query);
  if (opts?.json) console.log(JSON.stringify({ ok: true, results: res }));
  else if (res.length === 0) console.log('No matches.');
  else res.forEach((r) => console.log(`${r.kind}\t${r.name}\t${r.file}:${r.line}:${r.col}`));
}
