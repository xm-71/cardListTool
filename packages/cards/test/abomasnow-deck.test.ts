import { describe, expect, test } from 'vitest';
import type { DeckList, GameState, PlayerId } from '@ptcg/engine';
import { isPlayable } from '../src/playable.ts';
import abomasnow from '../src/decks/mega-abomasnow.json';
import {
  ID,
  act,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  has,
  registry,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const spec = {
  [ID.snover]: 4,
  [ID.megaAbomasnow]: 3,
  [ID.suicune]: 2,
  [ID.kyogre]: 2,
  [ID.mantine]: 2,
  [ID.eiscue]: 2,
  [ID.water]: 30,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const isWater = (s: GameState, u: string) => s.cards[u]!.defId === ID.water;
const toDiscard = (s: GameState, p: PlayerId, defId: string) => {
  const uid = giveCard(s, p, defId);
  s.players[p].hand.splice(s.players[p].hand.indexOf(uid), 1);
  s.players[p].discard.push(uid);
};

describe('Mega Abomasnow ex', () => {
  test('Hammer-lanche discards the top 6 cards and does 100 per Basic {W} Energy among them', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.megaAbomasnow);
    attachFromDeck(s0, me, ID.water);
    attachFromDeck(s0, me, ID.water);
    swapActiveTo(s0, opp, ID.megaAbomasnow);
    const top6 = s0.players[me].deck.slice(0, 6);
    const water = top6.filter((u) => isWater(s0, u)).length;
    const s = attack(s0);
    expect(s.players[me].discard).toEqual(expect.arrayContaining(top6));
    expect(s.players[opp].active!.damage).toBe(Math.min(350, 100 * water));
  });

  test('Hammer-lanche with fewer than 6 cards discards what is there', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.megaAbomasnow);
    attachFromDeck(s0, me, ID.water);
    attachFromDeck(s0, me, ID.water);
    swapActiveTo(s0, opp, ID.megaAbomasnow);
    const p = s0.players[me];
    p.discard.push(...p.deck.splice(2));
    const water = p.deck.filter((u) => isWater(s0, u)).length;
    const s = attack(s0);
    expect(s.players[me].deck).toHaveLength(0);
    expect(s.players[opp].active!.damage).toBe(100 * water);
  });

  test('Frost Barrier does 200 and takes 30 less damage next turn', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.megaAbomasnow);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ID.water);
    swapActiveTo(s0, opp, ID.megaAbomasnow);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, opp, ID.water);
    let s = attack(s0, 1);
    expect(s.players[opp].active!.damage).toBe(200);
    s = attack(s, 1);
    expect(s.players[me].active!.damage).toBe(170);
  });
});

describe('Suicune', () => {
  test('Crystal Fall does 30, or 120 with at least 4 {W} Energy in play', () => {
    const run = (benchEnergy: number) => {
      const { s: s0, me, opp } = game(spec);
      swapActiveTo(s0, me, ID.suicune);
      attachFromDeck(s0, me, ID.water);
      attachFromDeck(s0, me, ID.water);
      benchFromHand(s0, me, giveCard(s0, me, ID.mantine));
      for (let i = 0; i < benchEnergy; i++) attachFromDeck(s0, me, ID.water, 0);
      swapActiveTo(s0, opp, ID.megaAbomasnow);
      return attack(s0).players[opp].active!.damage;
    };
    expect(run(1)).toBe(30);
    expect(run(2)).toBe(120);
  });
});

describe('Kyogre', () => {
  test('Riptide does 20 per Basic {W} Energy in the discard pile, then shuffles them into the deck', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.kyogre);
    attachFromDeck(s0, me, ID.water);
    swapActiveTo(s0, opp, ID.megaAbomasnow);
    for (let i = 0; i < 4; i++) toDiscard(s0, me, ID.water);
    const deck = s0.players[me].deck.length;
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(80);
    expect(s.players[me].discard.filter((u) => isWater(s, u))).toHaveLength(0);
    expect(s.players[me].deck).toHaveLength(deck + 4);
  });

  test('Swirling Waves does 130 and discards 2 Energy from Kyogre', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.kyogre);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ID.water);
    swapActiveTo(s0, opp, ID.megaAbomasnow);
    const s = resolvePrompts(attack(s0, 1));
    expect(s.players[opp].active!.damage).toBe(130);
    expect(s.players[me].active!.energy).toHaveLength(1);
  });
});

describe('Mantine', () => {
  test('Call for Family puts up to 2 Basic Pokémon from the deck onto the Bench', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, ID.mantine);
    attachFromDeck(s0, me, ID.water);
    const bench = s0.players[me].bench.length;
    const s = resolvePrompts(attack(s0));
    expect(s.players[me].bench).toHaveLength(bench + 2);
  });
});

describe('Eiscue', () => {
  test('Freezing Headbutt does 20 and Paralyzes on heads', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 12 && outcomes.size < 2; seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, ID.eiscue);
      attachFromDeck(s0, me, ID.water);
      swapActiveTo(s0, opp, ID.megaAbomasnow);
      attachFromDeck(s0, opp, ID.water);
      attachFromDeck(s0, opp, ID.water);
      const s = attack(s0);
      const heads = s.log.some((e) => e.text === 'Coin flip: heads');
      expect(s.players[opp].active!.damage).toBe(20);
      expect(has(engine.getLegalActions(s, opp), 'attack')).toBe(!heads);
      outcomes.add(heads);
    }
    expect(outcomes.size).toBe(2);
  });
});

test('Mega Abomasnow ex theme deck: 60 cards, all exist and are playable', () => {
  const deck = abomasnow as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) {
    expect(registry.defs[c.id], c.id).toBeDefined();
    expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
  }
});
