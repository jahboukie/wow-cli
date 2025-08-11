import fs from 'fs-extra';
import path from 'path';
import ts from 'typescript';
import { logEvent } from './ledger.js';

export type SymbolEntry = {
  name: string;
  kind: 'function' | 'class' | 'method' | 'variable';
  file: string;
  line: number;
  col: number;
};

export type CodeIndex = {
  files: number;
  symbols: SymbolEntry[];
  createdAt: string;
};

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.wow']);
const VALID_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);

function shouldIgnore(p: string) {
  const parts = p.split(path.sep);
  return parts.some((seg) => IGNORE_DIRS.has(seg));
}

async function* walk(dir: string): AsyncGenerator<string> {
  const list = await fs.readdir(dir);
  for (const name of list) {
    const full = path.join(dir, name);
    if (shouldIgnore(full)) continue;
    const stat = await fs.stat(full);
    if (stat.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function addTSNodeSymbols(sf: ts.SourceFile, file: string, out: SymbolEntry[]) {
  function add(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
      out.push({ name: node.name.text, kind: 'function', file, line: line + 1, col: character + 1 });
    } else if (ts.isClassDeclaration(node) && node.name) {
      const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
      out.push({ name: node.name.text, kind: 'class', file, line: line + 1, col: character + 1 });
    } else if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
      out.push({ name: node.name.text, kind: 'method', file, line: line + 1, col: character + 1 });
    } else if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (d.name && ts.isIdentifier(d.name)) {
          const { line, character } = sf.getLineAndCharacterOfPosition(d.getStart());
          out.push({ name: d.name.text, kind: 'variable', file, line: line + 1, col: character + 1 });
        }
      }
    }
    ts.forEachChild(node, add);
  }
  add(sf);
}

function parseWithTS(file: string, src: string): SymbolEntry[] {
  const ext = path.extname(file).toLowerCase();
  const kind = ext === '.tsx' ? ts.ScriptKind.TSX
    : ext === '.ts' ? ts.ScriptKind.TS
    : ext === '.jsx' ? ts.ScriptKind.JSX
    : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const out: SymbolEntry[] = [];
  addTSNodeSymbols(sf, file, out);
  return out;
}

function parsePython(file: string, src: string): SymbolEntry[] {
  const out: SymbolEntry[] = [];
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mFunc = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(line);
    if (mFunc) out.push({ name: mFunc[1], kind: 'function', file, line: i + 1, col: 1 });
    const mClass = /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/.exec(line);
    if (mClass) out.push({ name: mClass[1], kind: 'class', file, line: i + 1, col: 1 });
  }
  return out;
}

export async function buildIndex(cwd = process.cwd()): Promise<CodeIndex> {
  const allFiles: string[] = [];
  for await (const f of walk(cwd)) {
    if (VALID_EXT.has(path.extname(f).toLowerCase())) allFiles.push(f);
  }
  const symbols: SymbolEntry[] = [];
  for (const file of allFiles) {
    try {
      const src = await fs.readFile(file, 'utf-8');
      const ext = path.extname(file).toLowerCase();
      if (ext === '.py') symbols.push(...parsePython(file, src));
      else symbols.push(...parseWithTS(file, src));
    } catch {
      // ignore file errors
    }
  }
  const index: CodeIndex = { files: allFiles.length, symbols, createdAt: new Date().toISOString() };
  await fs.ensureDir(path.join(cwd, '.wow'));
  await fs.writeJSON(path.join(cwd, '.wow', 'index.json'), index, { spaces: 2 });
  await logEvent('info', { msg: 'index.built', files: allFiles.length, symbols: symbols.length });
  return index;
}

export async function loadIndex(cwd = process.cwd()): Promise<CodeIndex | null> {
  const p = path.join(cwd, '.wow', 'index.json');
  if (!(await fs.pathExists(p))) return null;
  return await fs.readJSON(p);
}

export async function searchIndex(query: string, cwd = process.cwd()): Promise<SymbolEntry[]> {
  const idx = (await loadIndex(cwd)) || (await buildIndex(cwd));
  const q = query.toLowerCase();
  return idx.symbols.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 100);
}
