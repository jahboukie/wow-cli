import fs from 'fs';
import path from 'path';

export type Tier = 'free' | 'sponsor' | 'sponsor-dev';
export type Feature =
  | 'explainPlus'
  | 'verify'
  | 'evaluatorWeights'
  | 'advancedPolicy'
  | 'incrementalIndex'
  | 'ship'
  | 'pluginHooks'
  | 'secretStrictMode'
  | 'simulationArtifacts'
  | 'experimental';

interface Entitlement {
  tier: Tier;
  features: Record<Feature, boolean>;
  source: string;
}

// All non-experimental features are available in the free tier (no paywall for core value).
// Sponsor tiers only add early access (experimental) or may get time‑boxed previews before features graduate to free.
const FEATURE_SETS: Record<Tier, Feature[]> = {
  free: [
    'verify',
    'explainPlus',
    'evaluatorWeights',
    'advancedPolicy',
    'incrementalIndex',
    'ship',
    'pluginHooks',
    'secretStrictMode',
    'simulationArtifacts'
  ],
  sponsor: [
    'verify',
    'explainPlus',
    'evaluatorWeights',
    'advancedPolicy',
    'incrementalIndex',
    'ship',
    'pluginHooks',
    'secretStrictMode',
    'simulationArtifacts'
  ],
  'sponsor-dev': [
    'verify',
    'explainPlus',
    'evaluatorWeights',
    'advancedPolicy',
    'incrementalIndex',
    'ship',
    'pluginHooks',
    'secretStrictMode',
    'simulationArtifacts',
    'experimental'
  ]
};

const ALL_FEATURES: Feature[] = [
  'explainPlus',
  'verify',
  'evaluatorWeights',
  'advancedPolicy',
  'incrementalIndex',
  'ship',
  'pluginHooks',
  'secretStrictMode',
  'simulationArtifacts',
  'experimental'
];

let cached: Entitlement | null = null;

export function loadEntitlement(cwd: string = process.cwd()): Entitlement {
  if (cached) return cached;
  let tier: Tier = 'free';
  let source = 'default';

  const envTier = process.env.WOW_TIER as Tier | undefined;
  if (envTier && ['free','sponsor','sponsor-dev'].includes(envTier)) {
    tier = envTier;
    source = 'env:WOW_TIER';
  } else {
    const licensePath = path.join(cwd, '.wow', 'license.json');
    if (fs.existsSync(licensePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(licensePath,'utf8'));
        if (raw && typeof raw.tier === 'string' && ['free','sponsor','sponsor-dev'].includes(raw.tier)) {
          tier = raw.tier;
          source = 'file:.wow/license.json';
        }
      } catch {}
    }
  }

  const features: Record<Feature, boolean> = Object.fromEntries(ALL_FEATURES.map(f => [f,false])) as any;
  for (const f of FEATURE_SETS[tier]) features[f] = true;
  cached = { tier, features, source };
  return cached;
}

export function requireFeature(feature: Feature, opts: { json?: boolean } = {}): boolean {
  const ent = loadEntitlement();
  if (ent.features[feature]) return true;
  const msg = `Feature '${feature}' is available for sponsors (current tier: ${ent.tier}). See README for upgrade details.`;
  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: false, error: 'feature_locked', feature, tier: ent.tier }) + '\n');
  } else {
    console.error(msg);
  }
  process.exitCode = 2;
  return false;
}

export function listFeatures(human = false) {
  const ent = loadEntitlement();
  if (!human) {
    process.stdout.write(JSON.stringify({ tier: ent.tier, source: ent.source, features: ent.features }) + '\n');
    return;
  }
  console.log(`Tier: ${ent.tier} (source: ${ent.source})`);
  const rows = ALL_FEATURES.map(f => `${ent.features[f] ? '✓' : '✗'} ${f}`);
  console.log(rows.join('\n'));
}

export function clearEntitlementCache() { cached = null; }
