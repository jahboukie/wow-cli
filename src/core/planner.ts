import { logEvent } from './ledger.js';

export type PlanAction = 'run' | 'apply_patch' | 'write' | 'info' | 'triage';

export type PlanNode = {
  id: string;
  action: PlanAction;
  data?: any;
  criteria?: string[];
};

export type Plan = {
  kind: 'fix-build' | 'add-feature' | 'clean';
  nodes: PlanNode[];
  acceptance?: string[];
};

export async function planFixBuild(): Promise<Plan> {
  const nodes: PlanNode[] = [
    { id: 'n1', action: 'run', data: { cmd: 'npm test || yarn test || pnpm test' }, criteria: ['tests run'] },
    { id: 'n2', action: 'triage', data: { query: 'last_error' }, criteria: ['error triaged'] },
    { id: 'n3', action: 'info', data: { msg: 'Review triage results and test failures. Consider targeted patch then wow apply.' } },
  ];
  const plan: Plan = { kind: 'fix-build', nodes, acceptance: ['build green or failures understood'] };
  await logEvent('info', { msg: 'planner.fix-build', nodes: nodes.length });
  return plan;
}

export async function planAddFeature(desc: string): Promise<Plan> {
  const text = (desc || 'health check').trim();
  const content = `export function health() { return { status: 'ok', ts: new Date().toISOString() }; }\n`;
  const kebab = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'feature';
  const targetFile = `src/${kebab}.js`;
  const nodes: PlanNode[] = [
    { id: 'n1', action: 'write', data: { file: targetFile, content, message: `feat: add ${text}` }, criteria: ['file created'] },
    { id: 'n2', action: 'run', data: { cmd: `node -e "import('./${targetFile}').then(m=>console.log(m.health()))"` }, criteria: ['script runs'] },
  ];
  const plan: Plan = { kind: 'add-feature', nodes, acceptance: ['feature scaffolded and runnable'] };
  await logEvent('info', { msg: 'planner.add-feature', desc: text, nodes: nodes.length });
  return plan;
}

export async function planClean(): Promise<Plan> {
  const nodes: PlanNode[] = [
    {
      id: 'n1',
      action: 'run',
      data: {
        // Replaced complex inline script with a dedicated, cross-platform Node.js script
        cmd: 'node scripts/run-lint.mjs',
      },
      criteria: ['lints run'],
    },
  ];
  const plan: Plan = { kind: 'clean', nodes, acceptance: ['no new lints, formatting applied'] };
  await logEvent('info', { msg: 'planner.clean', nodes: nodes.length });
  return plan;
}
