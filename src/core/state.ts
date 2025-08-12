import fs from 'fs-extra';
import path from 'path';

export interface WowState {
  lintFailCount?: number; // cumulative lint failures
  lastScore?: number;
  lastConfidence?: number;
  lastUpdated?: string;
}

function stateFile(cwd = process.cwd()) {
  return path.join(cwd, '.wow', 'state.json');
}

export async function loadState(cwd = process.cwd()): Promise<WowState> {
  const file = stateFile(cwd);
  try {
    if (await fs.pathExists(file)) {
      return (await fs.readJSON(file)) as WowState;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export async function saveState(update: WowState, cwd = process.cwd()): Promise<void> {
  const file = stateFile(cwd);
  const prev = await loadState(cwd);
  const next: WowState = { ...prev, ...update, lastUpdated: new Date().toISOString() };
  await fs.ensureDir(path.dirname(file));
  await fs.writeJSON(file, next, { spaces: 2 });
}
