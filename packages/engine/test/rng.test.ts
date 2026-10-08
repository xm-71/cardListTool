import { expect, test } from 'vitest';
import { coinFlip, nextRandom, shuffle } from '../src/rng.ts';

test('the same seed gives the same sequence', () => {
  const seq = (seed: number) => {
    const out: number[] = [];
    let r = seed;
    for (let i = 0; i < 5; i++) {
      const [v, next] = nextRandom(r);
      out.push(v);
      r = next;
    }
    return out;
  };
  expect(seq(123)).toEqual(seq(123));
  expect(seq(123)).not.toEqual(seq(124));
  for (const v of seq(9)) expect(v >= 0 && v < 1).toBe(true);
});

test('shuffle returns a permutation and does not mutate its input', () => {
  const input = Array.from({ length: 60 }, (_, i) => i);
  const [out] = shuffle(input, 7);
  expect([...out].sort((a, b) => a - b)).toEqual(input);
  expect(out).not.toEqual(input);
  expect(input[0]).toBe(0);
});

test('coin flips are roughly fair', () => {
  let r = 1;
  let heads = 0;
  for (let i = 0; i < 10_000; i++) {
    const [h, next] = coinFlip(r);
    if (h) heads++;
    r = next;
  }
  expect(heads / 10_000).toBeGreaterThan(0.45);
  expect(heads / 10_000).toBeLessThan(0.55);
});
