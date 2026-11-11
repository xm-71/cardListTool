import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  act,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const CHIKORITA = 'me01-008';
const BAYLEEF = 'me01-009';
const MEGANIUM = 'me01-010';
const OGERPON = 'sv06-025';
const FRIGIBAX = 'sv02-057';
const GRASS = 'mee-001';
const FIRE = 'mee-002';
const spec = {
  [CHIKORITA]: 3,
  [BAYLEEF]: 3,
  [MEGANIUM]: 3,
  [OGERPON]: 3,
  [FRIGIBAX]: 3,
  [GRASS]: 20,
  [FIRE]: 6,
};
const attach = (s: GameState, p: PlayerId, defId: string, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, defId);
};
const canAttack = (s: GameState, p: PlayerId, i = 0) =>
  engine.getLegalActions(s, p).some((a) => a.type === 'attack' && a.attackIndex === i);
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
/** A tanky neutral Defending Pokémon (Water-type: no Weakness to Grass). */
const buffer = (s: GameState, opp: PlayerId) => {
  swapActiveTo(s, opp, FRIGIBAX);
  s.players[opp].active!.damage = -400;
};
/** `me` has `n` Meganium on the Bench and Teal Mask Ogerpon ex Active with `grass` Basic {G} Energy attached. */
const ogerpon = (n: number, grass: number, fire = 0) => {
  const { s, me, opp } = game(spec);
  swapActiveTo(s, me, OGERPON);
  for (let i = 0; i < n; i++) benchFromHand(s, me, giveCard(s, me, MEGANIUM));
  attach(s, me, GRASS, grass);
  attach(s, me, FIRE, fire);
  return { s, me, opp };
};

describe('Meganium', () => {
  test('Wild Growth lets one Basic {G} Energy pay for two {G}: Myriad Leaf Shower costs {G}{G}{G}', () => {
    expect(canAttack(ogerpon(0, 2).s, 0)).toBe(false); // without Meganium two Energy are not enough
    const { s, me } = ogerpon(1, 2);
    expect(canAttack(s, me)).toBe(true);
    expect(canAttack(ogerpon(1, 1).s, 0)).toBe(false); // one Energy gives only {G}{G}
  });

  test('Wild Growth does not stack with a second Meganium', () => {
    const { s, me } = ogerpon(2, 1);
    expect(canAttack(s, me)).toBe(false);
  });

  test('Wild Growth only doubles Basic {G} Energy, not other Energy', () => {
    const { s, me } = ogerpon(1, 1, 1);
    expect(canAttack(s, me)).toBe(false); // {G}{G} from the Grass Energy, nothing for the third {G}
  });

  test('Solar Beam ({G}{G}{C}{C}) does 140 and is paid by two Basic {G} Energy while Meganium is in play', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, MEGANIUM);
    attach(s0, me, GRASS, 2);
    buffer(s0, opp);
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(-400 + 140);
    const none = game(spec);
    swapActiveTo(none.s, none.me, BAYLEEF);
    attach(none.s, none.me, GRASS, 1);
    expect(canAttack(none.s, none.me)).toBe(false); // Push Down costs {G}{C}: one Energy is not enough without Meganium
  });

  test('Wild Growth also applies while Meganium is on the Bench, to Bayleef’s Push Down ({G}{C})', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, BAYLEEF);
    benchFromHand(s, me, giveCard(s, me, MEGANIUM));
    attach(s, me, GRASS, 1);
    expect(canAttack(s, me)).toBe(true);
  });
});

describe('Bayleef', () => {
  test('Push Down does 50 and the opponent chooses their new Active Pokémon', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, BAYLEEF);
    attach(s0, me, GRASS, 2);
    buffer(s0, opp);
    const benched = giveCard(s0, opp, FRIGIBAX);
    benchFromHand(s0, opp, benched);
    const s = resolvePrompts(attack(s0));
    expect(s.players[opp].active!.stack[0]).toBe(benched);
    expect(s.players[opp].bench[0]!.damage).toBe(-400 + 50);
  });

  test('Push Down with nothing on the opponent’s Bench just does damage', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, BAYLEEF);
    attach(s0, me, GRASS, 2);
    buffer(s0, opp);
    s0.players[opp].bench.length = 0;
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(-400 + 50);
  });
});
