import { describe, expect, test } from 'vitest';
import type { DeckList, GameState } from '@ptcg/engine';
import { GYM_DECKS } from '../src/gym.ts';
import { isPlayable } from '../src/playable.ts';
import {
  ID,
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

const CHARMANDER = sv('004');
const CHARMELEON = sv('005');
const CHARIZARD = sv('006');
const SQUIRTLE = sv('007');
const WARTORTLE = sv('008');
const BLASTOISE = sv('009');
const BULBASAUR = sv('001');
const IVYSAUR = sv('002');
const VENUSAUR = sv('003');
const ABRA = sv('063');
const R = 'mee-002';
const W = 'mee-003';
const G = 'mee-001';
const ALL = {
  [CHARMANDER]: 4,
  [CHARMELEON]: 4,
  [CHARIZARD]: 4,
  [SQUIRTLE]: 4,
  [WARTORTLE]: 4,
  [BLASTOISE]: 4,
  [BULBASAUR]: 4,
  [IVYSAUR]: 4,
  [VENUSAUR]: 4,
  [ABRA]: 4,
  [ID.riskyRuins]: 2,
  [R]: 8,
  [W]: 8,
  [G]: 8,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: 0 | 1, id: string, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, id);
};
/** A tanky neutral Defending Pokémon. */
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, ABRA);
  s.players[opp].active!.damage = -400;
};

describe('Champion Blue lists', () => {
  test.each(['blue-fire', 'blue-water', 'blue-grass'] as const)(
    '%s: 60 playable cards with the shared Alakazam line',
    (id) => {
      const deck = GYM_DECKS[id] as DeckList;
      expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
      for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
      const count = (card: string) => deck.cards.find((c) => c.id === card)?.count ?? 0;
      expect([count(ABRA), count(sv('064')), count(sv('065'))]).toEqual([4, 3, 3]);
    },
  );
});

describe('Fire line', () => {
  test('Blazing Destruction discards a Stadium in play (either player’s)', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, CHARMANDER);
    attach(s0, me, R, 1);
    buffer(s0, opp);
    const stadium = giveCard(s0, opp, ID.riskyRuins);
    s0.players[opp].hand.splice(s0.players[opp].hand.indexOf(stadium), 1);
    s0.stadium = { uid: stadium, owner: opp };
    const s = attack(s0, 0);
    expect(s.stadium).toBeNull();
    expect(s.players[opp].discard).toContain(stadium);
  });

  test('with no Stadium it does nothing', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, CHARMANDER);
    attach(s0, me, R, 1);
    buffer(s0, opp);
    expect(() => attack(s0, 0)).not.toThrow();
  });

  test('Fire Blast does 90 and discards an Energy from Charmeleon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, CHARMELEON);
    attach(s0, me, R, 3);
    buffer(s0, opp);
    const s = resolvePrompts(attack(s0, 1));
    expect(s.players[opp].active!.damage).toBe(-400 + 90);
    expect(s.players[me].active!.energy).toHaveLength(2);
  });

  test('Brave Wing does 60, or 160 with damage counters on Charizard ex', () => {
    const run = (hurt: number) => {
      const { s: s0, me, opp } = game(ALL, ALL);
      swapActiveTo(s0, me, CHARIZARD);
      attach(s0, me, R, 1);
      buffer(s0, opp);
      s0.players[me].active!.damage = hurt;
      return attack(s0, 0).players[opp].active!.damage;
    };
    expect(run(0)).toBe(-400 + 60);
    expect(run(10)).toBe(-400 + 160);
  });

  test('Explosive Vortex does 330 and discards 3 Energy from Charizard ex', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, CHARIZARD);
    attach(s0, me, R, 4);
    buffer(s0, opp);
    s0.players[opp].active!.damage = -800;
    const s = resolvePrompts(attack(s0, 1));
    expect(s.players[opp].active!.damage).toBe(-800 + 330);
    expect(s.players[me].active!.energy).toHaveLength(1);
  });
});

describe('Water line', () => {
  test('Withdraw prevents all damage to Squirtle on heads only', () => {
    const kinds = new Set<boolean>();
    for (let seed = 1; seed <= 20; seed++) {
      const { s: s0, me } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, SQUIRTLE);
      attach(s0, me, W, 1);
      const s = attack(s0, 0);
      const heads = s.log.slice(s0.log.length).some((l) => l.text === 'Coin flip: heads');
      expect(s.players[me].active!.markers.map((m) => m.kind)).toEqual(heads ? ['preventDamage'] : []);
      kinds.add(heads);
    }
    expect(kinds.size).toBe(2);
  });

  test('Free Diving puts up to 3 Basic {W} Energy from the discard pile into your hand', () => {
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, WARTORTLE);
    attach(s0, me, W, 1);
    const p = s0.players[me];
    for (let i = 0; i < 4; i++) {
      const uid = giveCard(s0, me, W);
      p.hand.splice(p.hand.indexOf(uid), 1);
      p.discard.push(uid);
    }
    const hand = p.hand.length;
    let s = attack(s0, 0);
    for (let i = 0; i < 3 && s.prompt; i++) s = answer(s, s.prompt.options[0]!.id);
    if (s.prompt) s = answer(s, 'done');
    expect(s.players[me].hand).toHaveLength(hand + 3);
  });

  test('Solid Shell takes 30 less damage after Weakness', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, SQUIRTLE);
    attach(s0, me, W, 2);
    swapActiveTo(s0, opp, BLASTOISE);
    const s = attack(s0, 1); // Skull Bash 20 -> 0 after Solid Shell
    expect(s.players[opp].active!.damage).toBe(0);
    const { s: t0, me: m1, opp: o1 } = game(ALL, ALL);
    swapActiveTo(t0, m1, WARTORTLE);
    attach(t0, m1, W, 2);
    swapActiveTo(t0, o1, BLASTOISE);
    expect(attack(t0, 1).players[o1].active!.damage).toBe(20); // 50 - 30
  });

  test('Twin Cannons does 140 for each Basic {W} Energy discarded from hand (up to 2)', () => {
    const run = (n: number) => {
      const { s: s0, me, opp } = game(ALL, ALL);
      swapActiveTo(s0, me, BLASTOISE);
      attach(s0, me, W, 2);
      buffer(s0, opp);
      const p = s0.players[me];
      p.deck.push(...p.hand.splice(0));
      for (let i = 0; i < n; i++) giveCard(s0, me, W);
      let s = attack(s0, 0);
      while (s.prompt?.player === me) {
        const o = s.prompt.options.find((x) => !s.prompt!.selected.includes(x.id));
        s = answer(s, o && s.prompt.selected.length < 2 ? o.id : 'done');
      }
      return s.players[opp].active!.damage;
    };
    expect(run(0)).toBe(-400);
    expect(run(1)).toBe(-400 + 140);
    expect(run(3)).toBe(-400 + 280);
  });
});

describe('Grass line', () => {
  test.each([
    ['Bulbasaur', BULBASAUR, 0, 20],
    ['Ivysaur', IVYSAUR, 0, 30],
  ])('%s: Leech Seed does its damage and heals 20 from itself', (_n, id, idx, dmg) => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, id);
    attach(s0, me, G, 2);
    buffer(s0, opp);
    s0.players[me].active!.damage = 50;
    const s = attack(s0, idx);
    expect(s.players[opp].active!.damage).toBe(-400 + dmg);
    expect(s.players[me].active!.damage).toBe(30);
  });

  test('Tranquil Flower heals 60 from 1 of your Pokémon, only while Active, once a turn', () => {
    const flower = (p: 0 | 1) =>
      ({ type: 'useAbility', slot: { player: p, zone: 'active' }, ability: 'Tranquil Flower' }) as const;
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, VENUSAUR);
    benchFromHand(s0, me, giveCard(s0, me, ABRA));
    expect(engine.getLegalActions(s0, me)).not.toContainEqual(flower(me)); // nothing damaged
    s0.players[me].bench[0]!.damage = 80;
    expect(engine.getLegalActions(s0, me)).toContainEqual(flower(me));
    let s = act(engine, s0, flower(me));
    s = resolvePrompts(s);
    expect(s.players[me].bench[0]!.damage).toBe(20);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(flower(me));
  });

  test('Dangerous Toxwhip does 150 and confuses and poisons', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, VENUSAUR);
    attach(s0, me, G, 3);
    buffer(s0, opp);
    const s = attack(s0, 0);
    const log = s.log.slice(s0.log.length).map((l) => l.text);
    expect(log.some((t) => t.endsWith('is now Confused'))).toBe(true);
    expect(log.some((t) => t.endsWith('is now Poisoned'))).toBe(true);
    expect(s.players[opp].active!.damage).toBe(-400 + 150 + 10);
  });
});
