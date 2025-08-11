import { health } from '../src/health.js';

export async function returns_ok() {
  const res = health();
  if (res.status !== 'ok') throw new Error(`expected status ok, got ${res.status}`);
}
