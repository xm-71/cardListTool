import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import {
  act,
  assertGymDeck,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

describe("Champion Lance's Johto deck", () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS['johto-lance']));

  test('is built around Dragonite, Mega Dragonite ex, Gyarados and Charizard ex', () => {
    const ids = GYM_DECKS['johto-lance'].cards.map((c) => c.id);
    for (const id of ['sv03.5-149', 'me02.5-152', 'sv03.5-130', 'sv03.5-006']) expect(ids).toContain(id);
  });
});

describe('Mega Dragonite ex', () => {
  const MEGA = 'me02.5-152';
  const TANK = 'sv06-008';
  const spec = { [MEGA]: 4, [TANK]: 4, 'sv03.5-148': 4, 'mee-003': 6, 'mee-004': 10 };
  const tank = (s: ReturnType<typeof game>['s'], opp: 0 | 1) => {
    swapActiveTo(s, opp, TANK);
    s.players[opp].active!.damage = -500;
  };

  test('Ryuno Glide does 330 and discards 2 Energy from itself', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, MEGA);
    tank(s0, opp);
    for (const e of ['mee-003', 'mee-004', 'mee-004', 'mee-004']) attachFromDeck(s0, me, e);
    const s = resolvePrompts(act(engine, s0, { type: 'attack', attackIndex: 0 }));
    expect(s.players[opp].active!.damage + 500).toBe(330);
    expect(s.players[me].active!.energy).toHaveLength(2);
  });

  test('Sky Transport switches the Active Pokémon with a Benched one, once per turn', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, MEGA);
    benchFromHand(s0, me, giveCard(s0, me, 'sv03.5-148'));
    const benched = s0.players[me].bench[0]!.stack[0]!;
    const sky = (p: 0 | 1, zone: 'active' | 'bench') =>
      ({
        type: 'useAbility',
        slot: zone === 'active' ? { player: p, zone } : { player: p, zone, index: 0 },
        ability: 'Sky Transport',
      }) as const;
    const s = resolvePrompts(act(engine, s0, sky(me, 'active')));
    expect(s.players[me].active!.stack[0]).toBe(benched);
    expect(() => act(engine, s, sky(me, 'bench'))).toThrow();
  });
});
