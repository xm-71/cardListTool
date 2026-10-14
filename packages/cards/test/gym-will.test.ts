import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { assertGymDeck } from './helpers.ts';

describe('Will deck', () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.will));

  test('is built around Slowpoke, Slowbro and Slowking with Exeggutor and Alakazam ex', () => {
    const ids = GYM_DECKS.will.cards.map((c) => c.id);
    for (const id of ['sv03.5-079', 'sv03.5-080', 'sv07-058', 'sv03.5-103', 'sv03.5-065'])
      expect(ids).toContain(id);
  });
});
