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
  has,
  playTrainer,
  registry,
  resolvePrompts,
  sv,
  swapActiveTo,
} from './helpers.ts';

const NIDORAN_F = sv('029');
const NIDORINA = sv('030');
const NIDOQUEEN = sv('031');
const NIDORAN_M = sv('032');
const NIDOKING = sv('034');
const RHYDON = sv('112');
const CHARISMA = sv('161');
const D = 'mee-007';
const F = 'mee-006';
const ALL = {
  [NIDORAN_F]: 4,
  [NIDORINA]: 4,
  [NIDOQUEEN]: 4,
  [NIDORAN_M]: 4,
  [NIDOKING]: 4,
  [RHYDON]: 4,
  [CHARISMA]: 4,
  [D]: 16,
  [F]: 8,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: 0 | 1, id: string, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, id);
};
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, NIDORAN_M);
  s.players[opp].active!.damage = -400;
};

test('Giovanni deck: 60 playable cards', () => {
  const deck = GYM_DECKS.giovanni as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
});

describe('Nidoran♀ and Nidorina', () => {
  test('Poison Horn poisons the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, NIDORAN_F);
    attach(s0, me, D, 2);
    buffer(s0, opp);
    const s = attack(s0, 0);
    expect(s.log.slice(s0.log.length).some((l) => l.text.endsWith('is now Poisoned'))).toBe(true);
    expect(s.players[opp].active!.damage).toBe(-400 + 20 + 10); // plus Poison at the end of the turn
  });

  test('Fetch Family reveals up to 3 Pokémon from the deck and puts them in your hand', () => {
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, NIDORINA);
    attach(s0, me, D, 1);
    const hand = s0.players[me].hand.length;
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[me].hand).toHaveLength(hand + 3);
    expect(s.log.some((l) => l.type === 'reveal')).toBe(true);
  });
});

describe('Nidoqueen', () => {
  test('Queen Press does 90 and prevents damage from Basic Pokémon only, next turn', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, NIDOQUEEN);
    attach(s0, me, D, 2);
    buffer(s0, opp);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 90);
    expect(s.players[me].active!.markers.map((m) => m.kind)).toEqual(['preventFromBasic']);
  });
});

describe('Nidoking', () => {
  const setup = (withQueen: boolean) => {
    const g = game(ALL, ALL);
    swapActiveTo(g.s, g.me, NIDOKING);
    buffer(g.s, g.opp);
    if (withQueen) benchFromHand(g.s, g.me, giveCard(g.s, g.me, NIDOQUEEN));
    return g;
  };

  test('with Nidoqueen in play a Nidoking with no Energy can attack; without, it cannot', () => {
    const a = setup(true);
    expect(has(engine.getLegalActions(a.s, a.me), 'attack')).toBe(true);
    const b = setup(false);
    expect(has(engine.getLegalActions(b.s, b.me), 'attack')).toBe(false);
  });

  test('Venomous Impact does 190 and poisons', () => {
    const { s: s0, opp } = setup(true);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 190 + 10);
    expect(s.log.slice(s0.log.length).some((l) => l.text.endsWith('is now Poisoned'))).toBe(true);
  });
});

describe('Giovanni’s Charisma', () => {
  test('moves an Energy from their Active to their hand, then attaches an Energy from your hand', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    buffer(s0, opp);
    attach(s0, opp, D, 1);
    const uid = giveCard(s0, me, CHARISMA);
    const myEnergy = giveCard(s0, me, F);
    const theirs = s0.players[opp].active!.energy[0]!;
    const s = resolvePrompts(act(engine, s0, playTrainer(uid)));
    expect(s.players[opp].active!.energy).toHaveLength(0);
    expect(s.players[opp].hand).toContain(theirs);
    expect(s.players[me].active!.energy.length).toBeGreaterThan(0);
    expect(myEnergy).toBeDefined();
  });

  test('does nothing, but still counts as played, when their Active has no Energy', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    buffer(s0, opp);
    const uid = giveCard(s0, me, CHARISMA);
    swapActiveTo(s0, me, RHYDON);
    attach(s0, me, F, 3);
    const s = act(engine, s0, playTrainer(uid));
    expect(s.players[me].supporterPlayed).toEqual({ turn: s0.turn, name: "Giovanni's Charisma" });
    const hit = attack(s, 1);
    expect(hit.players[opp].active!.damage).toBe(-400 + 180 * 2); // Charismatic Drill 180, doubled by Nidoran’s Fighting Weakness
  });
});
