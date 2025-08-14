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
      await Promise.resolve(fn()); // Ensure fn is treated as a promise
      results.push({ file, name, ok: true });
      passed++;
    } catch (e) { // Removed TypeScript-specific type annotation
      // Provide more detailed error logging, including stack trace if available
      const errorMessage = e?.stack || e?.message || String(e);
      results.push({ file, name, ok: false, error: errorMessage });
      failed++;
    }
  }
}

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.file} :: ${r.name}${r.ok ? '' : ' :: ' + r.error}`);
}
console.log(`\nSummary: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
