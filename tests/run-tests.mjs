import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = __dirname;

let passed = 0, failed = 0;
const results = [];

const files = (await fs.readdir(testsDir)).filter(f => f.endsWith('.test.mjs'));
for (const file of files) {
  const filePath = path.join(testsDir, file);
  const mod = await import(pathToFileURL(filePath).href);
  const cases = Object.entries(mod).filter(([k, v]) => typeof v === 'function');
  for (const [name, fn] of cases) {
    try {
      await fn();
      results.push({ file, name, ok: true });
      passed++;
    } catch (e) {
      results.push({ file, name, ok: false, error: e?.message || String(e) });
      failed++;
    }
  }
}

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.file} :: ${r.name}${r.ok ? '' : ' :: ' + r.error}`);
}
console.log(`\nSummary: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
