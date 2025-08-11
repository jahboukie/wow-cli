import { execa } from 'execa';

const DEFAULT_PATTERNS: { type: string; re: RegExp }[] = [
  { type: 'secret.aws_access_key', re: /AKIA[0-9A-Z]{16}/ },
  { type: 'secret.openai', re: /sk-[A-Za-z0-9]{32,}/ },
  { type: 'secret.google_api', re: /AIza[0-9A-Za-z\-_]{35}/ },
  { type: 'secret.slack', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { type: 'secret.private_key', re: /-----BEGIN (?:RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/ },
];

export async function scanStagedDiff(): Promise<string> {
  const { stdout } = await execa('git', ['diff', '--cached', '--unified=0']);
  return stdout;
}

export async function watchdogGate(): Promise<{ ok: boolean; issues: { type: string; detail: string }[] }> {
  const patch = await scanStagedDiff();
  const issues: { type: string; detail: string }[] = [];
  for (const { type, re } of DEFAULT_PATTERNS) {
    if (re.test(patch)) issues.push({ type, detail: 'pattern in staged diff' });
  }
  return { ok: issues.length === 0, issues };
}
