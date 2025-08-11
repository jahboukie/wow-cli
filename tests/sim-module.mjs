export async function main() {
  // benign computation
  return { ok: true, n: [1,2,3].reduce((a,b)=>a+b,0) };
}
