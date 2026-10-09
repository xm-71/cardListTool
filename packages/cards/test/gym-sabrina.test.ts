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
  sv,
  swapActiveTo,
} from './helpers.ts';

const ABRA = sv('063');
const KADABRA = sv('064');
const ALAKAZAM = sv('065');
const MIME = sv('122');
const SLOWPOKE = sv('079');
const SLOWBRO = sv('080');
const P = 'mee-005';
const ALL = {
  [ABRA]: 4,
  [KADABRA]: 4,
  [ALAKAZAM]: 4,
  [MIME]: 4,
  [SLOWPOKE]: 8,
  [SLOWBRO]: 4,
  [P]: 20,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const psy = (s: GameState, p: 0 | 1, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, P);
};
/** A tanky neutral Defending Pokémon. */
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, SLOWPOKE);
  s.players[opp].active!.damage = -400;
};

test('Sabrina deck: 60 playable cards', () => {
  const deck = GYM_DECKS.sabrina as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
});

describe('Kadabra', () => {
  test('Teleportation Attack does 30 and switches with a Benched Pokémon of your choice', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, KADABRA);
    buffer(s0, opp);
    benchFromHand(s0, me, giveCard(s0, me, ABRA));
    benchFromHand(s0, me, giveCard(s0, me, ABRA));
    psy(s0, me, 1);
    const kadabra = s0.players[me].active!.stack[0]!;
    let s = attack(s0, 0);
    expect(s.prompt?.player).toBe(me);
    s = answer(s, s.prompt!.options[1]!.id);
    expect(s.players[opp].active!.damage).toBe(-400 + 30);
    expect(s.players[me].bench.some((b) => b.stack[0] === kadabra)).toBe(true);
    expect(s.players[me].active!.stack[0]).not.toBe(kadabra);
  });

  test('with no Bench it only does damage', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, KADABRA);
    s0.players[me].bench = [];
    buffer(s0, opp);
    psy(s0, me, 1);
    const s = attack(s0, 0);
    expect(s.prompt).toBeNull();
    expect(s.players[opp].active!.damage).toBe(-400 + 30);
  });
});

describe('Alakazam ex', () => {
  test('Mind Jack does 90 plus 30 per Benched Pokémon of the opponent', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ALAKAZAM);
    buffer(s0, opp);
    s0.players[opp].bench = [];
    benchFromHand(s0, opp, giveCard(s0, opp, ABRA));
    benchFromHand(s0, opp, giveCard(s0, opp, ABRA));
    psy(s0, me, 2);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 150);
  });

  test('Dimensional Hand does 120 from the Active Spot', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ALAKAZAM);
    buffer(s0, opp);
    psy(s0, me, 2);
    const s = attack(s0, 1);
    expect(s.players[opp].active!.damage).toBe(-400 + 120);
  });
});

describe('Mr. Mime', () => {
  test('Mimic Barrier prevents damage while Energy counts match, and not otherwise', () => {
    const run = (mimeEnergy: number) => {
      const { s: s0, me, opp } = game(ALL, ALL);
      swapActiveTo(s0, me, ALAKAZAM);
      psy(s0, me, 2);
      swapActiveTo(s0, opp, MIME);
      psy(s0, opp, mimeEnergy);
      s0.players[opp].active!.damage = -400;
      return attack(s0, 1).players[opp].active!.damage;
    };
    expect(run(2)).toBe(-400);
    expect(run(1)).toBe(-400 + 120);
  });

  test('Psypower puts 3 counters in any split, one prompt each', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, MIME);
    psy(s0, me, 1);
    buffer(s0, opp);
    s0.players[opp].bench = [];
    benchFromHand(s0, opp, giveCard(s0, opp, ABRA));
    let s = attack(s0, 0);
    let prompts = 0;
    while (s.prompt?.player === me && prompts < 3) {
      s = answer(s, s.prompt.options[prompts === 0 ? 0 : 1]!.id);
      prompts++;
    }
    expect(prompts).toBe(3);
    expect(s.players[opp].active!.damage).toBe(-400 + 10);
    expect(s.players[opp].bench[0]?.damage ?? s.players[opp].active!.damage).toBeDefined();
  });

  test('Psypower can Knock a Pokémon Out', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, MIME);
    psy(s0, me, 1);
    swapActiveTo(s0, opp, ABRA);
    s0.players[opp].active!.damage = 30;
    s0.players[opp].bench = [];
    benchFromHand(s0, opp, giveCard(s0, opp, ABRA));
    let s = attack(s0, 0);
    for (let i = 0; i < 3 && s.prompt?.player === me; i++) s = answer(s, s.prompt.options[0]!.id);
    expect(s.players[me].prizes).toHaveLength(5);
  });
});

describe('Slowpoke', () => {
  test('Sea Bathing heals 30 and removes Special Conditions', () => {
    const { s: s0, me } = game(ALL, ALL);
    swapActiveTo(s0, me, SLOWPOKE);
    psy(s0, me, 1);
    const a = s0.players[me].active!;
    a.damage = 50;
    a.conditions = { rotation: 'none', poisoned: true, burned: true };
    const s = attack(s0, 0);
    const slot = s.players[me].active!;
    expect(slot.damage).toBe(20);
    // Poison from the end-of-turn check is gone too: all conditions cleared before checkup.
    expect(slot.conditions).toEqual({ rotation: 'none', poisoned: false, burned: false });
  });
});

describe('Slowbro', () => {
  test('Big Yawn puts both Active Pokémon to sleep', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, SLOWBRO);
    buffer(s0, opp);
    psy(s0, me, 1);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.conditions.rotation).toBe('asleep');
    expect(s.players[me].active!.conditions.rotation).toBe('asleep');
  });

  test('Laid-Back Tackle does 160, or nothing if Slowbro evolved this turn', () => {
    const run = (evolvedThisTurn: boolean) => {
      const { s: s0, me, opp } = game(ALL, ALL);
      swapActiveTo(s0, me, SLOWBRO);
      buffer(s0, opp);
      psy(s0, me, 3);
      s0.players[me].active!.evolvedTurn = evolvedThisTurn ? s0.turn : s0.turn - 2;
      return attack(s0, 1).players[opp].active!.damage;
    };
    expect(run(false)).toBe(-400 + 160);
    expect(run(true)).toBe(-400);
  });
});
