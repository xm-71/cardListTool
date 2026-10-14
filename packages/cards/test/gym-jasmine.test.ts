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
  swapActiveTo,
} from './helpers.ts';

const STEELIX = 'me01-093';
const MAGNEMITE = 'me01-045';
const MAGNETON = 'me01-046';
const MAGNEZONE = 'me01-047';
const SKARMORY = 'sv08-124';
const METAL = 'mee-008';
const LIGHTNING = 'mee-004';
const spec = {
  [STEELIX]: 4,
  [MAGNEMITE]: 4,
  [MAGNETON]: 4,
  [MAGNEZONE]: 4,
  [SKARMORY]: 4,
  [METAL]: 20,
  [LIGHTNING]: 20,
};
type S = ReturnType<typeof game>['s'];
const attack = (s: S, i: number) => act(engine, s, { type: 'attack', attackIndex: i });
/** A big Defending Pokémon; Steelix is weak to Fire, so Lightning and Metal attacks aren't doubled. */
const tank = (s: S, opp: 0 | 1) => {
  swapActiveTo(s, opp, STEELIX);
  s.players[opp].active!.damage = -500;
};
const dealt = (s: S, opp: 0 | 1) => s.players[opp].active!.damage + 500;

describe('Jasmine deck', () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.jasmine));
});

describe('Steelix', () => {
  test('Welcoming Tail does 40, or 240 with exactly 6 Prize cards remaining', () => {
    const run = (prizes: number) => {
      const { s: s0, me, opp } = game(spec);
      swapActiveTo(s0, me, STEELIX);
      tank(s0, opp);
      attachFromDeck(s0, me, METAL);
      attachFromDeck(s0, me, METAL);
      s0.players[me].prizes.length = prizes;
      return dealt(attack(s0, 0), opp);
    };
    expect(run(6)).toBe(240);
    expect(run(5)).toBe(40);
  });
});

describe('Magnezone', () => {
  test('Upper Spark does 50, or 170 if it evolved from Magneton this turn', () => {
    const plain = game(spec);
    swapActiveTo(plain.s, plain.me, MAGNEZONE);
    tank(plain.s, plain.opp);
    attachFromDeck(plain.s, plain.me, LIGHTNING);
    expect(dealt(attack(plain.s, 0), plain.opp)).toBe(50);

    const { s: s0, me, opp } = game(spec, spec, { turn: 3 });
    swapActiveTo(s0, me, MAGNETON);
    s0.players[me].active!.evolvedTurn = null;
    s0.players[me].active!.enteredTurn = 0;
    tank(s0, opp);
    attachFromDeck(s0, me, LIGHTNING);
    const evolved = act(engine, s0, {
      type: 'evolve',
      uid: giveCard(s0, me, MAGNEZONE),
      target: { player: me, zone: 'active' },
    });
    expect(dealt(attack(evolved, 0), opp)).toBe(170);
  });

  test("Flashing Bolt does 160 and can't be used again next turn", () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, MAGNEZONE);
    tank(s0, opp);
    attachFromDeck(s0, me, LIGHTNING);
    attachFromDeck(s0, me, LIGHTNING);
    const s = attack(s0, 1);
    expect(dealt(s, opp)).toBe(160);
    expect(s.players[me].active!.attackLocks['Flashing Bolt']).toBeGreaterThan(s.turn);
  });
});

describe('Skarmory', () => {
  test('Steel Wing does 50 and takes 30 less damage next turn', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, SKARMORY);
    tank(s0, opp);
    attachFromDeck(s0, me, METAL);
    attachFromDeck(s0, me, METAL);
    benchFromHand(s0, me, giveCard(s0, me, MAGNEMITE));
    const s = attack(s0, 0);
    expect(dealt(s, opp)).toBe(50);
    expect(s.players[me].active!.markers).toContainEqual(
      expect.objectContaining({ kind: 'reduceIncoming', amount: 30 }),
    );
  });
});
