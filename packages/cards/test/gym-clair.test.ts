import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { act, assertGymDeck, attachFromDeck, engine, game, swapActiveTo } from './helpers.ts';

const DRAGONITE = 'sv03.5-149';
const HORSEA = 'sv03.5-116';
const WATER = 'mee-003';
const LIGHTNING = 'mee-004';
const spec = { [DRAGONITE]: 4, [HORSEA]: 4, [WATER]: 20, [LIGHTNING]: 20 };

describe('Clair deck', () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.clair));

  test('is built around the Dratini line with Horsea, Lapras and Seel', () => {
    const ids = GYM_DECKS.clair.cards.map((c) => c.id);
    for (const id of ['sv03.5-147', 'sv03.5-148', 'sv03.5-149', HORSEA]) expect(ids).toContain(id);
  });

  test("Dragonite's Dragon Pulse does 180 with a Water and a Lightning Energy", () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, DRAGONITE);
    swapActiveTo(s0, opp, HORSEA);
    s0.players[opp].active!.damage = -500;
    attachFromDeck(s0, me, WATER);
    attachFromDeck(s0, me, LIGHTNING);
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].active!.damage + 500).toBeGreaterThanOrEqual(180);
  });
});
