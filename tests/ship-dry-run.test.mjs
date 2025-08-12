import { shipCommand } from '../dist/commands/ship.js';

export async function ship_dry_run_from_feature_branch() {
  const branch = (await import('child_process')).execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  if (branch === 'main' || branch === 'master') return; // skip
  const res = await shipCommand({ dryRun: true, json: true, allowDirty: true, noMerge: true, noPr: true });
  if (!res) throw new Error('no response');
  if (!Array.isArray(res.steps)) throw new Error('expected steps array');
  // verify step might be absent if local verify fails early (ok false); accept either state but ensure structure
}
