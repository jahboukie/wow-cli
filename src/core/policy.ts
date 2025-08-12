import fs from 'fs-extra';
import path from 'path';

export type CommandPolicy = { simulateFirst?: boolean; minConfidence?: number; minScore?: number };
export type Policy = {
  simulateFirst?: boolean;
  minConfidence?: number;
  minScore?: number;
  commands?: { [k: string]: CommandPolicy };
};

export async function loadPolicy(cwd = process.cwd()): Promise<Policy> {
  const p = path.join(cwd, '.wow', 'policy.json');
  if (!(await fs.pathExists(p))) return {};
  try {
    const data = await fs.readJSON(p);
    return (data || {}) as Policy;
  } catch {
    return {};
  }
}

export function resolveCommandPolicy(policy: Policy, name: string): CommandPolicy {
  const base: CommandPolicy = { simulateFirst: policy.simulateFirst, minConfidence: policy.minConfidence, minScore: policy.minScore };
  const cmd = policy.commands?.[name] || {};
  return {
    simulateFirst: cmd.simulateFirst ?? base.simulateFirst,
    minConfidence: cmd.minConfidence ?? base.minConfidence,
    minScore: cmd.minScore ?? base.minScore,
  };
}
