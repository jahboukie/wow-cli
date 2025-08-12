import { evaluateProject } from '../dist/core/evaluator.js';
import { saveState } from '../dist/core/state.js';
import fs from 'fs/promises';
import path from 'path';

// This test simulates repeated lint failures by crafting a temp workspace with an eslint script that exits 2.
export async function adaptive_penalty_applies() {
  const tmp = path.join(process.cwd(), 'tmp-penalty-test');
  await fs.mkdir(tmp, { recursive: true });
  const pkg = {
    name: 'penalty-test',
    version: '0.0.0',
    type: 'module',
    scripts: { lint: 'node -e "process.exit(2)"' }
  };
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify(pkg, null, 2));
  // Reset state to simulate consecutive failures
  await saveState({ lintFailCount: 2 }, tmp); // already 2 failures so next failure crosses threshold (3)
  const res = await evaluateProject(tmp);
  if (!res.penaltyApplied || res.penaltyPoints !== 5) {
    throw new Error('expected penalty applied with 5 points');
  }
  if (res.originalScore === res.score) {
    throw new Error('score should be reduced');
  }
}
