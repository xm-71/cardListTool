import { expect, test } from 'vitest';
import { setCards } from '@ptcg/cards';
import { setProgress } from '../src/game/collection.ts';

test('setProgress counts the distinct cards of the set that are owned', () => {
  const [a, b] = setCards('base1');
  expect(setProgress({}, 'base1')).toEqual({ owned: 0, total: setCards('base1').length });
  expect(setProgress({ [a!.id]: 3, [b!.id]: 1, 'base2-1': 4 }, 'base1').owned).toBe(2);
  expect(setProgress({ [a!.id]: 0 }, 'base1').owned).toBe(0);
});
