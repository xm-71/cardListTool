import { describe, expect, test } from 'vitest';
import type { DeckList, GameState } from '@ptcg/engine';
import { GYM_DECKS } from '../src/gym.ts';
import { isPlayable } from '../src/playable.ts';
import {
  act,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  registry,
  resolvePrompts,
  sv,
  swapActiveTo,
} from './helpers.ts';

const MACHOP = sv('066');
const MACHOKE = sv('067');
const MACHAMP = sv('068');
const HITMONLEE = sv('106');
const HITMONCHAN = sv('107');
const ONIX = sv('095');
const F = 'mee-006';
const ALL = {
  [MACHOP]: 4,
  [MACHOKE]: 4,
  [MACHAMP]: 4,
  [HITMONLEE]: 4,
  [HITMONCHAN]: 4,
  [ONIX]: 4,
  [F]: 24,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: 0 | 1, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, F);
};
/** A tanky neutral Defending Pokémon. */
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, ONIX);
  s.players[opp].active!.damage = -400;
};

test('Bruno deck: 60 playable cards', () => {
  const deck = GYM_DECKS.bruno as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
});

describe('Machop, Machoke, Machamp', () => {
  test.each([
    ['Machop', MACHOP, 0, 1, 0],
    ['Machoke', MACHOKE, 0, 1, 50],
    ['Machamp (Mountain Chopping)', MACHAMP, 0, 2, 100],
  ])('%s discards the top cards of the opponent’s deck', (_n, id, idx, cards, dmg) => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, id);
    attach(s0, me, 2);
    buffer(s0, opp);
    const top = s0.players[opp].deck.slice(0, cards);
    const s = attack(s0, idx);
    expect(s.players[opp].discard).toEqual(expect.arrayContaining(top));
    expect(s.players[opp].deck).toHaveLength(s0.players[opp].deck.length - cards - 1); // and they draw for their turn
    expect(s.players[opp].active!.damage).toBe(-400 + dmg);
  });

  test('an empty deck is fine', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, MACHAMP);
    attach(s0, me, 2);
    buffer(s0, opp);
    s0.players[opp].deck = [];
    expect(() => attack(s0, 0)).not.toThrow();
  });

  test('Guts: on heads Machamp survives a Knock Out with 10 HP left; on tails it is Knocked Out', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 30; seed++) {
      const { s: s0, me, opp } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, ONIX);
      attach(s0, me, 4);
      swapActiveTo(s0, opp, MACHAMP);
      benchFromHand(s0, opp, giveCard(s0, opp, MACHOP));
      s0.players[opp].active!.damage = 100;
      const s = resolvePrompts(attack(s0, 1)); // Heavy Impact, 100 -> 200 damage on 180 HP
      const heads = s.log.slice(s0.log.length).some((l) => l.text === 'Coin flip: heads');
      const machamp = s.cards[s0.players[opp].active!.stack.at(-1)!]!;
      const alive = [s.players[opp].active, ...s.players[opp].bench].some(
        (sl) => sl?.stack.at(-1) === machamp.uid,
      );
      expect(alive).toBe(heads);
      if (heads) {
        const slot = [s.players[opp].active, ...s.players[opp].bench].find(
          (sl) => sl?.stack.at(-1) === machamp.uid,
        )!;
        expect(slot.damage).toBe(170);
      }
      outcomes.add(heads);
    }
    expect(outcomes.size).toBe(2);
  });
});

describe('Hitmonlee', () => {
  test('Twister Kick does 10 to every opposing Pokémon (no Weakness on the Bench) and switches', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, HITMONLEE);
    attach(s0, me, 1);
    buffer(s0, opp);
    s0.players[opp].bench = [];
    for (let i = 0; i < 2; i++) benchFromHand(s0, opp, giveCard(s0, opp, MACHOP));
    benchFromHand(s0, me, giveCard(s0, me, MACHOP));
    const lee = s0.players[me].active!.stack[0]!;
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[opp].active!.damage).toBe(-400 + 10);
    expect(s.players[opp].bench.map((b) => b.damage)).toEqual([10, 10]);
    expect(s.players[me].bench.some((b) => b.stack[0] === lee)).toBe(true);
  });

  test('Low Kick does 100', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, HITMONLEE);
    attach(s0, me, 3);
    buffer(s0, opp);
    expect(attack(s0, 1).players[opp].active!.damage).toBe(-400 + 100);
  });
});

describe('Hitmonchan', () => {
  test('Counterattack puts 3 damage counters on the attacker, even if Hitmonchan is Knocked Out', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ONIX);
    attach(s0, me, 4);
    swapActiveTo(s0, opp, HITMONCHAN);
    benchFromHand(s0, opp, giveCard(s0, opp, MACHOP));
    s0.players[opp].active!.damage = 100;
    const s = resolvePrompts(attack(s0, 1)); // 100 damage Knocks it Out (120 HP)
    expect(s.players[opp].discard.some((u) => s.cards[u]!.defId === HITMONCHAN)).toBe(true);
    expect(s.players[me].active!.damage).toBe(30);
  });

  test('does not trigger from the Bench', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ONIX);
    attach(s0, me, 4);
    buffer(s0, opp);
    benchFromHand(s0, opp, giveCard(s0, opp, HITMONCHAN));
    const s = attack(s0, 1);
    expect(s.players[me].active!.damage).toBe(0);
  });

  test('Excited Punch does 60 and 60 more the next turn', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, HITMONCHAN);
    attach(s0, me, 2);
    buffer(s0, opp);
    let s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 60);
    s = act(engine, s, { type: 'endTurn' });
    s.players[me === 0 ? 0 : 1].active!.damage = 0;
    s = attack(s, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 60 + 120);
  });
});
