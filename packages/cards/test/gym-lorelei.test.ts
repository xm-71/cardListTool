import { describe, expect, test } from 'vitest';
import { getRetreatCost, type DeckList, type GameState } from '@ptcg/engine';
import { GYM_DECKS } from '../src/gym.ts';
import { isPlayable } from '../src/playable.ts';
import {
  act,
  answer,
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

const SEEL = sv('086');
const DEWGONG = sv('087');
const SHELLDER = sv('090');
const CLOYSTER = sv('091');
const LAPRAS = sv('131');
const JYNX = sv('124');
const ARTICUNO = sv('144');
const W = 'mee-003';
const R = 'mee-002';
const ALL = {
  [SEEL]: 4,
  [DEWGONG]: 4,
  [SHELLDER]: 4,
  [CLOYSTER]: 4,
  [LAPRAS]: 4,
  [JYNX]: 4,
  [ARTICUNO]: 4,
  [W]: 20,
  [R]: 8,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: 0 | 1, id: string, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, id);
};
/** A tanky neutral Defending Pokémon (Water isn't weak to Water; Seel is weak to Lightning). */
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, SEEL);
  s.players[opp].active!.damage = -400;
};

test('Lorelei deck: 60 playable cards', () => {
  const deck = GYM_DECKS.lorelei as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
});

describe('Dewgong', () => {
  test('Dual Splash does 50 to each of 2 chosen Pokémon (counters on the Bench)', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, DEWGONG);
    attach(s0, me, W, 2);
    buffer(s0, opp);
    s0.players[opp].bench = [];
    for (let i = 0; i < 3; i++) benchFromHand(s0, opp, giveCard(s0, opp, SEEL));
    let s = attack(s0, 0);
    expect(s.prompt?.player).toBe(me);
    // options: Active, Bench 1..3 -> choose Active + the second Bench
    s = answer(s, s.prompt!.options[0]!.id);
    s = answer(s, s.prompt!.options[1]!.id);
    if (s.prompt) s = answer(s, 'done');
    expect(s.players[opp].active!.damage).toBe(-400 + 50);
    expect(s.players[opp].bench.map((b) => b.damage)).toEqual([0, 50, 0]);
  });

  test('two Benched targets leave the Active Pokémon unhurt', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, DEWGONG);
    attach(s0, me, W, 2);
    buffer(s0, opp);
    s0.players[opp].bench = [];
    for (let i = 0; i < 2; i++) benchFromHand(s0, opp, giveCard(s0, opp, SEEL));
    let s = attack(s0, 0);
    s = answer(s, s.prompt!.options[1]!.id);
    s = answer(s, s.prompt!.options.find((o) => o.slot?.zone === 'bench')!.id);
    if (s.prompt) s = answer(s, 'done');
    expect(s.players[opp].active!.damage).toBe(-400);
    expect(s.players[opp].bench.map((b) => b.damage)).toEqual([50, 50]);
  });
});

describe('Shellder and Cloyster', () => {
  test.each([
    ['Shellder', SHELLDER, 2, 30],
    ['Cloyster', CLOYSTER, 2, 80],
  ])('%s takes less damage next turn', (_n, id, energy, less) => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, id);
    attach(s0, me, W, energy);
    buffer(s0, opp);
    const s = attack(s0, 0);
    expect(s.players[me].active!.markers).toEqual([
      { kind: 'reduceIncoming', amount: less, untilTurn: s0.turn + 1 },
    ]);
  });
});

describe('Lapras', () => {
  test('Hop on My Back puts up to 2 Pokémon from the deck into your hand', () => {
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, LAPRAS);
    attach(s0, me, W, 1);
    const hand = s0.players[me].hand.length;
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[me].hand).toHaveLength(hand + 2);
  });
});

describe('Jynx ex', () => {
  test('Heart-Stopping Kiss Knocks Out an Asleep Defending Pokémon and does nothing otherwise', () => {
    const run = (asleep: boolean) => {
      const { s: s0, me, opp } = game(ALL, ALL);
      swapActiveTo(s0, me, JYNX);
      attach(s0, me, W, 3);
      swapActiveTo(s0, opp, SEEL);
      s0.players[opp].bench = [];
      benchFromHand(s0, opp, giveCard(s0, opp, SEEL));
      if (asleep) s0.players[opp].active!.conditions.rotation = 'asleep';
      const s = resolvePrompts(attack(s0, 0));
      return { s, me };
    };
    expect(run(true).s.players[run(true).me].prizes).toHaveLength(5);
    expect(run(false).s.players[run(false).me].prizes).toHaveLength(6);
  });

  test('Icy Wind does 120 and puts the Defending Pokémon to sleep', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, JYNX);
    attach(s0, me, W, 3);
    buffer(s0, opp);
    const s = attack(s0, 1);
    expect(s.players[opp].active!.damage).toBe(-400 + 120);
    expect(s.log.slice(s0.log.length).some((l) => l.text.endsWith('is now Asleep'))).toBe(true);
  });
});

describe('Articuno', () => {
  test('Ice Float: no Retreat Cost with {W} Energy attached, normal otherwise', () => {
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, ARTICUNO);
    const ref = { player: me, zone: 'active' } as const;
    attach(s0, me, R, 1);
    expect(getRetreatCost(s0, ref, registry)).toBe(2);
    attach(s0, me, W, 1);
    expect(getRetreatCost(s0, ref, registry)).toBe(0);
  });

  test('Blizzard does 110 and 10 to each Benched Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ARTICUNO);
    attach(s0, me, W, 3);
    buffer(s0, opp);
    s0.players[opp].bench = [];
    for (let i = 0; i < 2; i++) benchFromHand(s0, opp, giveCard(s0, opp, SEEL));
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 110);
    expect(s.players[opp].bench.map((b) => b.damage)).toEqual([10, 10]);
  });
});
