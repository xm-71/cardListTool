import { describe, expect, test } from 'vitest';
import type { DeckList } from '@ptcg/engine';
import { GYM_DECKS } from '../src/gym.ts';
import { assertGymDeck } from './helpers.ts';

/** Iono (Paldea Evolved, regulation mark G) with Basic Psychic Energy: legal for leaders, not for the Gym format. */
const markG: DeckList = {
  name: 'mark G',
  cards: [
    { id: 'sv02-185', count: 4 },
    { id: 'mee-005', count: 56 },
  ],
};

describe('Gym deck legality modes', () => {
  test('the Gym format rejects a mark G card', () => {
    expect(() => assertGymDeck(markG)).toThrow();
    expect(() => assertGymDeck(markG, 'gym')).toThrow();
  });
  test('the leader pool allows a mark G card', () => {
    expect(() => assertGymDeck(markG, 'leader')).not.toThrow();
  });
  test('an existing Gym deck passes both', () => {
    expect(() => assertGymDeck(GYM_DECKS.brock, 'gym')).not.toThrow();
    expect(() => assertGymDeck(GYM_DECKS.brock, 'leader')).not.toThrow();
  });
  test('the leader pool still rejects a card older than mark D', () => {
    const old: DeckList = {
      name: 'old',
      cards: [
        { id: 'base1-4', count: 4 },
        { id: 'mee-005', count: 56 },
      ],
    };
    expect(() => assertGymDeck(old, 'leader')).toThrow();
  });
});
