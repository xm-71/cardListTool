import { describe, expect, test } from 'vitest';
import type { DeckList, GameState } from '@ptcg/engine';
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

const GROWLITHE = sv('058');
const ARCANINE = sv('059');
const PONYTA = sv('077');
const RAPIDASH = sv('078');
const VULPIX = sv('037');
const NINETALES = sv('038');
const R = 'mee-002';
const W = 'mee-003';
const ALL = {
  [GROWLITHE]: 4,
  [ARCANINE]: 4,
  [PONYTA]: 4,
  [RAPIDASH]: 4,
  [VULPIX]: 4,
  [NINETALES]: 4,
  [R]: 20,
  [W]: 10,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
/** Burn is applied by the attack and then checked at the end of the turn (20 damage), so read it from the log. */
const burnedBy = (s: GameState, from: GameState) =>
  s.log.slice(from.log.length).some((l) => l.text.endsWith('is now Burned'));
const attach = (s: GameState, p: 0 | 1, id: string, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, id);
};
/** A tanky neutral Defending Pokémon (Fire isn't weak against Fire). */
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, GROWLITHE);
  s.players[opp].active!.damage = -400;
};

test('Blaine deck: 60 playable cards', () => {
  const deck = GYM_DECKS.blaine as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
});

describe('Growlithe', () => {
  test('Vaporize discards a {W} Energy from the Defending Pokémon, and nothing with none', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, GROWLITHE);
    attach(s0, me, R, 1);
    buffer(s0, opp);
    attach(s0, opp, W, 1);
    attach(s0, opp, R, 1);
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[opp].active!.energy.map((u) => s.cards[u]!.defId)).toEqual([R]);
    const { s: t0, me: m1, opp: o1 } = game(ALL, ALL);
    swapActiveTo(t0, m1, GROWLITHE);
    attach(t0, m1, R, 1);
    buffer(t0, o1);
    attach(t0, o1, R, 1);
    const t = attack(t0, 0);
    expect(t.prompt).toBeNull();
    expect(t.players[o1].active!.energy).toHaveLength(1);
  });
});

describe('Arcanine', () => {
  test('Torrid Torrent does 30 and attaches up to 2 Basic {R} Energy from the discard pile', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ARCANINE);
    attach(s0, me, R, 1);
    buffer(s0, opp);
    const p = s0.players[me];
    for (let i = 0; i < 3; i++) {
      const uid = giveCard(s0, me, R);
      p.hand.splice(p.hand.indexOf(uid), 1);
      p.discard.push(uid);
    }
    let s = attack(s0, 0);
    s = answer(s, s.prompt!.options[0]!.id);
    s = answer(s, s.prompt!.options[0]!.id);
    if (s.prompt) s = answer(s, 'done');
    expect(s.players[opp].active!.damage).toBe(-400 + 30);
    expect(s.players[me].active!.energy).toHaveLength(3);
    expect(s.players[me].discard.filter((u) => s.cards[u]!.defId === R)).toHaveLength(1);
  });

  test('Dynamite Fang does 240 and discards 2 {R} Energy from itself', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ARCANINE);
    attach(s0, me, R, 4);
    buffer(s0, opp);
    const s = resolvePrompts(attack(s0, 1));
    expect(s.players[opp].active!.damage).toBe(-400 + 240);
    expect(s.players[me].active!.energy).toHaveLength(2);
  });
});

describe('Ponyta and Rapidash', () => {
  test('Collect draws a card', () => {
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, PONYTA);
    attach(s0, me, R, 1);
    const hand = s0.players[me].hand.length;
    const s = attack(s0, 0);
    expect(s.players[me].hand).toHaveLength(hand + 1);
  });

  test('Singe burns the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, RAPIDASH);
    attach(s0, me, R, 1);
    buffer(s0, opp);
    const s = attack(s0, 0);
    expect(burnedBy(s, s0)).toBe(true);
    expect(s.players[opp].active!.damage).toBe(-400 + 20); // burn damage at the end of the turn
  });

  test('Mach Turn does 90 and switches with a Benched Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, RAPIDASH);
    attach(s0, me, R, 3);
    buffer(s0, opp);
    benchFromHand(s0, me, giveCard(s0, me, PONYTA));
    const rapidash = s0.players[me].active!.stack[0]!;
    const s = resolvePrompts(attack(s0, 1));
    expect(s.players[opp].active!.damage).toBe(-400 + 90);
    expect(s.players[me].active!.stack[0]).not.toBe(rapidash);
    expect(s.players[me].bench.some((b) => b.stack[0] === rapidash)).toBe(true);
  });
});

describe('Vulpix', () => {
  test('Super Singe does 20 and burns on heads only', () => {
    const seen = new Set<boolean>();
    for (let seed = 1; seed <= 20; seed++) {
      const { s: s0, me, opp } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, VULPIX);
      attach(s0, me, R, 2);
      buffer(s0, opp);
      const s = attack(s0, 0);
      const firstFlip = s.log.slice(s0.log.length).find((l) => l.type === 'coinFlip')!;
      const heads = firstFlip.text === 'Coin flip: heads';
      expect(burnedBy(s, s0)).toBe(heads);
      expect(s.players[opp].active!.damage).toBe(-400 + 20 + (heads ? 20 : 0));
      seen.add(heads);
    }
    expect(seen.size).toBe(2);
  });
});

describe('Ninetales ex', () => {
  test('Heat Wave does 30 and burns', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, NINETALES);
    attach(s0, me, R, 1);
    buffer(s0, opp);
    const s = attack(s0, 0);
    expect(burnedBy(s, s0)).toBe(true);
    expect(s.players[opp].active!.damage).toBe(-400 + 30 + 20);
  });

  test('Mirrored Flames does 80, or 220 with equal hand sizes', () => {
    const run = (equal: boolean) => {
      const { s: s0, me, opp } = game(ALL, ALL);
      swapActiveTo(s0, me, NINETALES);
      attach(s0, me, R, 2);
      buffer(s0, opp);
      const mine = s0.players[me].hand.length;
      const o = s0.players[opp];
      while (o.hand.length > mine + (equal ? 0 : 2)) o.deck.push(o.hand.pop()!);
      while (o.hand.length < mine + (equal ? 0 : 2)) o.hand.push(o.deck.shift()!);
      return attack(s0, 1).players[opp].active!.damage;
    };
    expect(run(true)).toBe(-400 + 220);
    expect(run(false)).toBe(-400 + 80);
  });
});
