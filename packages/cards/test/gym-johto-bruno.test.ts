import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { act, assertGymDeck, attachFromDeck, engine, game, swapActiveTo } from './helpers.ts';

describe("Bruno's Johto deck", () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS['johto-bruno']));

  test('is built around Hitmontop, Hariyama and Mega Lucario ex with Steelix', () => {
    const ids = GYM_DECKS['johto-bruno'].cards.map((c) => c.id);
    for (const id of ['me02.5-102', 'me01-073', 'me01-077', 'me01-093']) expect(ids).toContain(id);
  });
});

describe('Hitmontop', () => {
  test('Spin and Draw shuffles the hand into the deck and draws 6', () => {
    const { s: s0, me } = game({ 'me02.5-102': 4 });
    swapActiveTo(s0, me, 'me02.5-102');
    attachFromDeck(s0, me, 'mee-007');
    const handBefore = new Set(s0.players[me].hand);
    expect(handBefore.size).toBeGreaterThan(0);
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[me].hand).toHaveLength(6);
  });
});
