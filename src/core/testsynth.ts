import fs from 'fs-extra';
import path from 'path';

function guessExportNames(src: string): string[] {
  const names = new Set<string>();
  const fnRe = /export\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  const constRe = /export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(src))) names.add(m[1]);
  while ((m = constRe.exec(src))) names.add(m[1]);
  return Array.from(names);
}

export async function synthTestForJsModule(relFile: string) {
  const cwd = process.cwd();
  const srcPath = path.join(cwd, relFile);
  if (!(await fs.pathExists(srcPath))) return null;
  const code = await fs.readFile(srcPath, 'utf-8');
  const names = guessExportNames(code);
  const exportName = names[0] || 'defaultExport';
  const base = path.basename(relFile, path.extname(relFile));
  const testDir = path.join(cwd, 'tests');
  const testFile = path.join(testDir, `${base}.test.mjs`);
  if (await fs.pathExists(testFile)) return null; // don't overwrite
  const importPath = `../${relFile.replace(/\\/g, '/')}`;
  const body = `import * as mod from '${importPath}';

export async function ${exportName}_is_callable() {
  const fn = mod['${exportName}'] || (typeof mod.default === 'function' ? mod.default : null);
  if (!fn) throw new Error('no callable export found');
  const res = await Promise.resolve(fn());
  if (res === undefined) throw new Error('expected a value');
}
`;
  await fs.ensureDir(testDir);
  await fs.writeFile(testFile, body, 'utf-8');
  return testFile;
}
