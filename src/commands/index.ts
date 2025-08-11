import { buildIndex } from '../core/indexer.js';

export async function indexCommand(opts: { json?: boolean }) {
  const idx = await buildIndex();
  if (opts?.json) console.log(JSON.stringify({ ok: true, files: idx.files, symbols: idx.symbols.length }));
  else console.log(`Indexed ${idx.files} files, found ${idx.symbols.length} symbols.`);
}
