import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { act, answerCards, assertGymDeck, attachFromDeck, engine, game, swapActiveTo } from './helpers.ts';

const ZUBAT = 'sv06.5-027';
const GOLBAT = 'sv06.5-028';
const CROBAT = 'sv06.5-029';
const LILLIE = 'me01-119';
const DARK = 'mee-007';
const TANK = 'sv06-008'; // Heracross: Fighting weakness only
const VENOMOTH = 'sv03.5-049';
const spec = {
  [TANK]: 4,
  [VENOMOTH]: 4,
  [ZUBAT]: 4,
  [GOLBAT]: 4,
  [CROBAT]: 4,
  [LILLIE]: 4,
  ['mee-001']: 6,
  [DARK]: 14,
};
const attack = (s: Parameters<typeof act>[1], i: number) =>
  act(engine, s, { type: 'attack', attackIndex: i });
const tank = (s: ReturnType<typeof game>['s'], opp: 0 | 1) => {
  swapActiveTo(s, opp, TANK);
  s.players[opp].active!.damage = -500;
};
const dealt = (s: ReturnType<typeof game>['s'], opp: 0 | 1) => s.players[opp].active!.damage + 500;

describe("Koga's Johto deck", () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS['johto-koga']));

  test('is built around the Zubat line with Venomoth and Nidoking', () => {
    const ids = GYM_DECKS['johto-koga'].cards.map((c) => c.id);
    for (const id of [ZUBAT, GOLBAT, CROBAT, 'sv03.5-049', 'sv03.5-034']) expect(ids).toContain(id);
  });
});

describe('Zubat, Golbat and Crobat', () => {
  test('Lead puts a Supporter from the deck into your hand', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ZUBAT);
    tank(s0, opp);
    attachFromDeck(s0, me, DARK);
    const before = s0.players[me].hand.filter((u) => s0.cards[u]!.defId === LILLIE).length;
    const s = answerCards(attack(s0, 0), [LILLIE]);
    expect(s.players[me].hand.filter((u) => s.cards[u]!.defId === LILLIE).length).toBe(before + 1);
  });

  test("Pitch-Black Blade does 80 and the Pokémon can't attack next turn", () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, GOLBAT);
    tank(s0, opp);
    attachFromDeck(s0, me, DARK);
    attachFromDeck(s0, me, DARK);
    const s = attack(s0, 1);
    expect(dealt(s, opp)).toBe(80);
    expect(Object.keys(s.players[me].active!.attackLocks).length).toBeGreaterThan(0);
  });

  test('Poison Fang does 120 and Poisons the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, CROBAT);
    tank(s0, opp);
    attachFromDeck(s0, me, DARK);
    attachFromDeck(s0, me, DARK);
    const s = attack(s0, 0);
    expect(dealt(s, opp)).toBeGreaterThanOrEqual(120);
    expect(s.players[opp].active!.conditions.poisoned).toBe(true);
  });
});

describe('Venomoth', () => {
  test('Perplexing Powder does 30, Confuses and locks Items for a turn', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, VENOMOTH);
    tank(s0, opp);
    attachFromDeck(s0, me, 'mee-001');
    const s = attack(s0, 0);
    expect(dealt(s, opp)).toBe(30);
    expect(s.players[opp].active!.conditions.rotation).toBe('confused');
    expect(s.players[opp].itemLockedTurn).toBe(s.turn);
  });
});
