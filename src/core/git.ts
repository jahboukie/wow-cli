import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';

function gitPaths() {
  const cwd = process.cwd();
  const gitDir = path.join(cwd, '.wow', 'git');
  return { cwd, gitDir };
}

function gitEnv() {
  const { cwd, gitDir } = gitPaths();
  return { ...process.env, GIT_DIR: gitDir, GIT_WORK_TREE: cwd } as NodeJS.ProcessEnv;
}

export async function ensureGit() {
  const { gitDir } = gitPaths();
  await fs.ensureDir(gitDir);
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree'], { env: gitEnv() });
  } catch {
    await execa('git', ['init', '-b', 'main'], { env: gitEnv() });
  }
}

export async function newBranch(prefix: string) {
  await ensureGit();
  const name = `${prefix}/${Date.now()}`;
  await execa('git', ['checkout', '-b', name], { env: gitEnv() });
  return name;
}

export async function stageAll() {
  await ensureGit();
  await execa('git', ['add', '-A'], { env: gitEnv() });
}

export async function commitAll(message: string) {
  await ensureGit();
  // allow-empty to ensure initial commits succeed in empty repos
  await execa('git', ['commit', '--allow-empty', '-m', message], { env: gitEnv() });
}

export async function applyUnifiedDiff(patch: string) {
  await ensureGit();
  const tmp = `.wow/tmp-${Date.now()}.diff`;
  await fs.ensureDir('.wow');
  await fs.writeFile(tmp, patch, 'utf-8');
  try {
    await execa('git', ['apply', '--whitespace=nowarn', tmp], { env: gitEnv() });
  } finally {
    await fs.remove(tmp);
  }
}
