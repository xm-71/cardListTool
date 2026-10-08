/** mulberry32: returns a float in [0, 1) and the next PRNG state. */
export function nextRandom(rng: number): [number, number] {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function shuffle<T>(arr: readonly T[], rng: number): [T[], number] {
  const out = [...arr];
  let r = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [v, next] = nextRandom(r);
    r = next;
    const j = Math.floor(v * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return [out, r];
}

export function coinFlip(rng: number): [boolean, number] {
  const [v, next] = nextRandom(rng);
  return [v < 0.5, next];
}
