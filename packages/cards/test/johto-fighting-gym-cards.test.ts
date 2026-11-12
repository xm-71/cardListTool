import { describe, expect, test } from 'vitest';
import { act, attachFromDeck, engine, game, swapActiveTo } from './helpers.ts';

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
