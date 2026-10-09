import { describe, expect, test } from 'vitest';
import { getRetreatCost, type DeckList, type GameState } from '@ptcg/engine';
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

const DRATINI = sv('147');
const DRAGONAIR = sv('148');
const DRAGONITE = sv('149');
const MAGIKARP = sv('129');
const GYARADOS = sv('130');
const W = 'mee-003';
const L = 'mee-004';
const ALL = {
  [DRATINI]: 4,
  [DRAGONAIR]: 4,
  [DRAGONITE]: 4,
  [MAGIKARP]: 6,
  [GYARADOS]: 4,
  [W]: 20,
  [L]: 8,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: 0 | 1, id: string, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, id);
};
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, DRATINI);
  s.players[opp].active!.damage = -400;
};

test('Lance deck: 60 playable cards', () => {
  const deck = GYM_DECKS.lance as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
});

describe('Dragonair', () => {
  test('Aqua Slash does 90 and Dragonair can’t attack during your next turn', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, DRAGONAIR);
    attach(s0, me, W, 1);
    attach(s0, me, L, 1);
    buffer(s0, opp);
    let s = attack(s0, 1);
    expect(s.players[opp].active!.damage).toBe(-400 + 90);
    s = act(engine, s, { type: 'endTurn' });
    expect(s.current).toBe(me);
    expect(engine.getLegalActions(s, me).some((a) => a.type === 'attack')).toBe(false);
  });
});

describe('Dragonite', () => {
  test('Jet Cruise gives all your Pokémon in play no Retreat Cost, and only yours', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, MAGIKARP);
    swapActiveTo(s0, opp, MAGIKARP);
    benchFromHand(s0, me, giveCard(s0, me, GYARADOS));
    const gyarados = { player: me, zone: 'bench', index: 0 } as const;
    expect(getRetreatCost(s0, gyarados, registry)).toBe(4);
    benchFromHand(s0, me, giveCard(s0, me, DRAGONITE));
    expect(getRetreatCost(s0, gyarados, registry)).toBe(0);
    expect(getRetreatCost(s0, { player: me, zone: 'active' }, registry)).toBe(0);
    expect(getRetreatCost(s0, { player: opp, zone: 'active' }, registry)).toBe(1);
  });

  test('Dragon Pulse does 180 and discards the top 2 cards of your deck', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, DRAGONITE);
    attach(s0, me, W, 1);
    attach(s0, me, L, 1);
    buffer(s0, opp);
    const top = s0.players[me].deck.slice(0, 2);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 180);
    expect(s.players[me].discard).toEqual(expect.arrayContaining(top));
  });
});

describe('Magikarp', () => {
  test('Splashy Splash draws a card for each heads before the first tails', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 25; seed++) {
      const { s: s0, me } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, MAGIKARP);
      attach(s0, me, W, 1);
      const hand = s0.players[me].hand.length;
      const s = attack(s0, 0);
      const heads = s.log.slice(s0.log.length).filter((l) => l.text === 'Coin flip: heads').length;
      expect(s.players[me].hand).toHaveLength(hand + heads);
      seen.add(heads);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('Gyarados', () => {
  test('Untamed One is mandatory: no prompt, the top 5 cards of the deck are discarded', () => {
    const { s: s0, me } = game(ALL, ALL, { turn: 3 });
    benchFromHand(s0, me, giveCard(s0, me, MAGIKARP));
    const gy = giveCard(s0, me, GYARADOS);
    const deck = s0.players[me].deck.length;
    const discard = s0.players[me].discard.length;
    const s = act(engine, s0, { type: 'evolve', uid: gy, target: { player: me, zone: 'bench', index: 0 } });
    expect(s.prompt).toBeNull();
    expect(s.players[me].deck).toHaveLength(deck - 5);
    expect(s.players[me].discard).toHaveLength(discard + 5);
  });

  test('with fewer than 5 cards in the deck it discards what is there', () => {
    const { s: s0, me } = game(ALL, ALL, { turn: 3 });
    benchFromHand(s0, me, giveCard(s0, me, MAGIKARP));
    const gy = giveCard(s0, me, GYARADOS);
    s0.players[me].deck = s0.players[me].deck.slice(0, 3);
    const s = act(engine, s0, { type: 'evolve', uid: gy, target: { player: me, zone: 'bench', index: 0 } });
    expect(s.players[me].deck).toHaveLength(0);
  });

  test('Hyper Beam does 200 and discards an Energy from the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, GYARADOS);
    attach(s0, me, W, 4);
    buffer(s0, opp);
    attach(s0, opp, W, 2);
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[opp].active!.damage).toBe(-400 + 200);
    expect(s.players[opp].active!.energy).toHaveLength(1);
  });
});
