import { expect, test } from 'vitest';
import type { DeckList } from '@ptcg/engine';
import { GYM_DECKS, buildRegistry, isPlayable } from '@ptcg/cards';
import { validateGymDeck } from '../src/index.ts';

const registry = buildRegistry();
const ownAll = Object.fromEntries(Object.keys(registry.defs).map((id) => [id, 99]));

/** Each gym deck task raises this by the number of decks it adds (Kanto: 12 leaders + 3 Champion lists). */
const EXPECTED_DECKS = 5;

test('every Kanto gym deck is registered', () => {
  expect(Object.keys(GYM_DECKS)).toHaveLength(EXPECTED_DECKS);
});

test.each(Object.entries(GYM_DECKS as Record<string, DeckList>))(
  '%s: 60 playable Gym-legal cards',
  (_id, deck) => {
    expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
    for (const c of deck.cards) {
      expect(registry.defs[c.id], c.id).toBeDefined();
      expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
    }
    expect(validateGymDeck(deck, registry, ownAll)).toEqual([]);
  },
);
