import * as mod from '../src/ping.js';

export async function health_is_callable() {
  const fn = mod['health'] || (typeof mod.default === 'function' ? mod.default : null);
  if (!fn) throw new Error('no callable export found');
  const res = await Promise.resolve(fn());
  if (res === undefined) throw new Error('expected a value');
}
