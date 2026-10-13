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

const PIDGEY = 'sv03.5-016';
const PIDGEOT = 'sv03.5-018';
const HOOTHOOT = 'sv07-114';
const NOCTOWL = 'sv05-127';
const ENERGY = 'mee-004';
const spec = { [PIDGEY]: 6, [PIDGEOT]: 4, [HOOTHOOT]: 6, [NOCTOWL]: 4, [ENERGY]: 30, 'me01-114': 4 };

const attack = (s: Parameters<typeof act>[1], i: number) =>
  act(engine, s, { type: 'attack', attackIndex: i });
const tank = (s: ReturnType<typeof game>['s'], opp: 0 | 1) => {
  swapActiveTo(s, opp, PIDGEY);
  s.players[opp].active!.damage = -500;
};

describe('Falkner deck', () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.falkner));
});

describe('Pidgey', () => {
  test('Call for Family puts up to 2 Basic Pokémon from the deck onto the Bench', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, PIDGEY);
    attachFromDeck(s0, me, ENERGY);
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[me].bench.length).toBe(2);
  });
});

describe('Pidgeot', () => {
  test('Fly does 150 and protects it on heads, and does nothing on tails', () => {
    let heads = 0;
    let tails = 0;
    for (let seed = 1; seed < 40 && (heads === 0 || tails === 0); seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, PIDGEOT);
      tank(s0, opp);
      for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ENERGY);
      const s = attack(s0, 1);
      const dealt = s.players[opp].active!.damage + 500;
      const protectedKinds = s.players[me].active!.markers.map((m) => m.kind);
      if (dealt === 150) {
        heads++;
        expect(protectedKinds).toEqual(expect.arrayContaining(['preventDamage', 'preventEffects']));
      } else {
        tails++;
        expect(dealt).toBe(0);
        expect(protectedKinds).toEqual([]);
      }
    }
    expect(heads).toBeGreaterThan(0);
    expect(tails).toBeGreaterThan(0);
  });
});

describe('Hoothoot', () => {
  test('Triple Stab does 10 damage for each of 3 coin flips that is heads', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed < 60; seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, HOOTHOOT);
      tank(s0, opp);
      attachFromDeck(s0, me, ENERGY);
      const s = attack(s0, 0);
      const dealt = s.players[opp].active!.damage + 500;
      expect([0, 10, 20, 30]).toContain(dealt);
      seen.add(dealt);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('Noctowl', () => {
  test('Talon Hunt does 70 and may put up to 2 cards from the deck into the hand', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, NOCTOWL);
    tank(s0, opp);
    for (let i = 0; i < 2; i++) attachFromDeck(s0, me, ENERGY);
    benchFromHand(s0, me, giveCard(s0, me, PIDGEY));
    const handBefore = s0.players[me].hand.length;
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[opp].active!.damage + 500).toBe(70);
    expect(s.players[me].hand.length).toBeGreaterThan(handBefore - 1);
    expect(s.players[me].hand.length).toBeLessThanOrEqual(handBefore + 2);
  });
});
