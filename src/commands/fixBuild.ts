import { planFixBuild } from '../core/planner.js';
import { execute } from '../core/executor.js';
import { buildIndex } from '../core/indexer.js';

export async function fixBuildCommand() {
  await buildIndex();
  const plan = await planFixBuild();
  await execute(plan, { branchPrefix: 'fix' });
  console.log('Fix-build plan executed. Review test output and use wow apply for patches.');
}
