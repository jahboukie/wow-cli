import { planClean } from '../core/planner.js';
import { execute } from '../core/executor.js';
import { buildIndex } from '../core/indexer.js';

export async function cleanCommand() {
  await buildIndex();
  const plan = await planClean();
  await execute(plan, { branchPrefix: 'chore' });
  console.log('Clean plan executed.');
}
