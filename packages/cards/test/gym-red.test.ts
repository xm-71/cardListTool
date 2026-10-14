import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { assertGymDeck } from './helpers.ts';

describe("Red's deck", () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.red));

  test('is built around Charizard ex and Pikachu with Snorlax, in Fire and Lightning', () => {
    const ids = GYM_DECKS.red.cards.map((c) => c.id);
    for (const id of ['sv03.5-006', 'sv03.5-025', 'sv03.5-026', 'sv03.5-143', 'mee-002', 'mee-004']) {
      expect(ids).toContain(id);
    }
  });
});
