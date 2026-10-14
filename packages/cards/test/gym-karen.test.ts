import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { act, assertGymDeck, attachFromDeck, engine, game, resolvePrompts, swapActiveTo } from './helpers.ts';

describe("Karen's deck", () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.karen));

  test('is built around Umbreon ex, Houndoom and Honchkrow', () => {
    const ids = GYM_DECKS.karen.cards.map((c) => c.id);
    for (const id of ['sv08.5-060', 'sv08.5-074', 'sv08.5-063', 'me02-058']) expect(ids).toContain(id);
  });
});

describe('Karen scripts', () => {
  const UMBREON = 'sv08.5-060';
  const EEVEE = 'sv08.5-074';
  const HOUNDOOM = 'sv08.5-063';
  const MURKROW = 'me02-057';
  const HONCHKROW = 'me02-058';
  const DARK = 'mee-007';
  const TANK = 'sv06-008'; // Heracross
  const spec = {
    [TANK]: 4,
    [UMBREON]: 2,
    [EEVEE]: 2,
    [HOUNDOOM]: 2,
    [MURKROW]: 2,
    [HONCHKROW]: 2,
    'mee-004': 4,
    'mee-005': 4,
  };
  const attack = (s: Parameters<typeof act>[1], i: number) =>
    act(engine, s, { type: 'attack', attackIndex: i });
  const tank = (s: ReturnType<typeof game>['s'], opp: 0 | 1) => {
    swapActiveTo(s, opp, TANK);
    s.players[opp].active!.damage = -500;
  };
  const dealt = (s: ReturnType<typeof game>['s'], opp: 0 | 1) => s.players[opp].active!.damage + 500;
  const energize = (s: ReturnType<typeof game>['s'], me: 0 | 1, n: number) => {
    for (let i = 0; i < n; i++) attachFromDeck(s, me, DARK);
  };

  test('Moon Mirage does 160 and Confuses', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, UMBREON);
    tank(s0, opp);
    energize(s0, me, 3);
    const s = attack(s0, 0);
    expect(dealt(s, opp)).toBe(160);
    expect(s.players[opp].active!.conditions.rotation).toBe('confused');
  });

  test('Onyx discards all Energy and takes a Prize card', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, UMBREON);
    tank(s0, opp);
    for (const e of ['mee-004', 'mee-005', DARK]) attachFromDeck(s0, me, e);
    const prizes = s0.players[me].prizes.length;
    const hand = s0.players[me].hand.length;
    const s = attack(s0, 1);
    expect(s.players[me].active!.energy).toHaveLength(0);
    expect(s.players[me].prizes).toHaveLength(prizes - 1);
    expect(s.players[me].hand.length).toBeGreaterThan(hand);
  });

  test('Onyx never takes the last Prize (the engine cannot end the game from an attack effect)', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, UMBREON);
    tank(s0, opp);
    for (const e of ['mee-004', 'mee-005', DARK]) attachFromDeck(s0, me, e);
    s0.players[me].prizes = s0.players[me].prizes.slice(0, 1);
    const s = attack(s0, 1);
    expect(s.players[me].active!.energy).toHaveLength(0);
    expect(s.players[me].prizes).toHaveLength(1);
    expect(s.result).toBeNull();
  });

  test('Reckless Charge does 30 and 10 to Eevee itself', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, EEVEE);
    tank(s0, opp);
    energize(s0, me, 2);
    const s = attack(s0, 0);
    expect(dealt(s, opp)).toBe(30);
    expect(s.players[me].active!.damage).toBe(10);
  });

  test('Call to Muster attaches up to 2 Basic Energy from the deck', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, HOUNDOOM);
    tank(s0, opp);
    energize(s0, me, 1);
    const s = resolvePrompts(attack(s0, 0));
    expect(
      s.players[me].active!.energy.length + s.players[me].bench.reduce((n, b) => n + b.energy.length, 0),
    ).toBe(3);
  });

  test('Ambush does 10, or 30 on heads', () => {
    const results = new Set<number>();
    for (let seed = 1; seed <= 12 && results.size < 2; seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, MURKROW);
      tank(s0, opp);
      energize(s0, me, 1);
      results.add(dealt(attack(s0, 0), opp));
    }
    expect([...results].sort()).toEqual([10, 30]);
  });

  test('Sniping Feathers discards 2 Energy and does 120', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, HONCHKROW);
    tank(s0, opp);
    energize(s0, me, 3);
    const s = resolvePrompts(attack(s0, 1));
    expect(s.players[me].active!.energy).toHaveLength(1);
    expect(dealt(s, opp)).toBe(120);
  });
});
