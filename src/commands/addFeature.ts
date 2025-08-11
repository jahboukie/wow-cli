import { planAddFeature } from '../core/planner.js';
import { execute } from '../core/executor.js';

export async function addFeatureCommand(desc: string) {
  const plan = await planAddFeature(desc);
  await execute(plan, { branchPrefix: 'feat' });
  console.log('Feature scaffolded.');
}
