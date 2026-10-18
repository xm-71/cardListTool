import { expect, test } from 'vitest';
import type { DeckList } from '@ptcg/engine';
import { GYM_DECKS, buildRegistry, isPlayable } from '@ptcg/cards';
import { validateGymDeck } from '../src/index.ts';

const registry = buildRegistry();
const ownAll = Object.fromEntries(Object.keys(registry.defs).map((id) => [id, 99]));

/** Each gym deck task raises this by the number of decks it adds (Kanto: 12 leaders + 3 Champion lists; Johto so far: 4 leaders). */
const EXPECTED_DECKS = 29;

/** Leaders on meta decks draw from the wider leader pool (mark D or later); `assertGymDeck(deck, 'leader')` in the cards tests checks them. */
const META_LEADERS = new Set(['lorelei', 'bruno', 'agatha', 'lance']);

test('every Kanto and Johto gym deck is registered', () => {
  expect(Object.keys(GYM_DECKS)).toHaveLength(EXPECTED_DECKS);
});

test.each(Object.entries(GYM_DECKS as Record<string, DeckList>))(
  '%s: 60 playable Gym-legal cards',
  (id, deck) => {
    expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
    for (const c of deck.cards) {
      expect(registry.defs[c.id], c.id).toBeDefined();
      expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
    }
    if (!META_LEADERS.has(id)) expect(validateGymDeck(deck, registry, ownAll)).toEqual([]);
  },
);
