import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  act,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  registry,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const KLAWF = 'sv09-090';
const KLAWF_OTHER_PRINTS = ['sv01-122', 'sv04-105'];
const TERAPAGOS = 'sv07-128';
const FRIGIBAX = 'sv02-057'; // Basic, Water
const FROGADIER = 'me04-021'; // Stage 1
const FIGHTING = 'mee-006';
const GRASS = 'mee-001';
const WATER = 'mee-003';
const LIGHTNING = 'mee-004';
const spec = {
  [KLAWF]: 3,
  [TERAPAGOS]: 3,
  [FRIGIBAX]: 6,
  [FROGADIER]: 2,
  [FIGHTING]: 14,
  [GRASS]: 3,
  [WATER]: 3,
  [LIGHTNING]: 3,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: PlayerId, defId: string, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, defId);
};
const heads = (s: GameState) => s.log.filter((e) => e.text === 'Coin flip: heads').length;
const canAttack = (s: GameState, p: PlayerId, i = 0) =>
  engine.getLegalActions(s, p).some((a) => a.type === 'attack' && a.attackIndex === i);

describe('Klawf', () => {
  test('Snipping Pincers discards one Energy from the Defending Pokémon for each heads of 2 coins', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60 && seen.size < 3; seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, KLAWF);
      attach(s0, me, FIGHTING, 2);
      swapActiveTo(s0, opp, FRIGIBAX);
      attach(s0, opp, FIGHTING, 3);
      const s = resolvePrompts(attack(s0, 0));
      const h = heads(s);
      expect(s.players[opp].active!.energy).toHaveLength(3 - h);
      expect(s.players[opp].discard.filter((u) => s.cards[u]!.defId === FIGHTING)).toHaveLength(h);
      seen.add(h);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  test('Snipping Pincers never discards more Energy than the Defending Pokémon has', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, KLAWF);
      attach(s0, me, FIGHTING, 2);
      swapActiveTo(s0, opp, FRIGIBAX);
      attach(s0, opp, FIGHTING, 1);
      const s = resolvePrompts(attack(s0, 0));
      expect(s.players[opp].active!.energy).toHaveLength(heads(s) >= 1 ? 0 : 1);
    }
  });

  test('Snipping Pincers does nothing to a Defending Pokémon without Energy', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, KLAWF);
    attach(s0, me, FIGHTING, 2);
    swapActiveTo(s0, opp, FRIGIBAX);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.energy).toHaveLength(0);
    expect(s.players[opp].discard).toHaveLength(0);
  });

  test('Hammer In does 100', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, KLAWF);
    attach(s0, me, FIGHTING, 3);
    swapActiveTo(s0, opp, FRIGIBAX);
    s0.players[opp].active!.damage = -400;
    expect(attack(s0, 1).players[opp].active!.damage).toBe(-400 + 100);
  });

  test('only the sv09 Klawf gets this script: the other Klawf prints have different attacks', () => {
    expect(registry.scripts[KLAWF]).toBeDefined();
    for (const id of KLAWF_OTHER_PRINTS) expect(registry.scripts[id], id).toBeUndefined();
  });
});

describe('Terapagos ex', () => {
  const setup = (bench: number) => {
    const { s, me, opp } = game(spec, spec, { turn: 3 });
    swapActiveTo(s, me, TERAPAGOS);
    attach(s, me, FIGHTING, 2);
    for (let i = 0; i < bench; i++) benchFromHand(s, me, giveCard(s, me, FRIGIBAX));
    swapActiveTo(s, opp, FRIGIBAX);
    s.players[opp].active!.damage = -400;
    return { s, me, opp };
  };

  test('Unified Beatdown does 30 for each of your Benched Pokémon (and none of the opponent’s)', () => {
    for (const bench of [0, 2, 5]) {
      const { s: s0, opp } = setup(bench);
      for (let i = 0; i < 3; i++) benchFromHand(s0, opp, giveCard(s0, opp, FRIGIBAX));
      const s = resolvePrompts(attack(s0, 0));
      expect(s.players[opp].active!.damage, `bench ${bench}`).toBe(-400 + 30 * bench);
    }
  });

  test('Unified Beatdown cannot be used on the first turn of the player who goes second, but can on their next turn', () => {
    const { s: s0, me } = game(spec); // the second player's first turn
    swapActiveTo(s0, me, TERAPAGOS);
    attach(s0, me, FIGHTING, 2);
    expect(canAttack(s0, me)).toBe(false);
    let s = act(engine, s0, { type: 'endTurn' });
    s = act(engine, s, { type: 'endTurn' });
    expect(s.current).toBe(me);
    expect(canAttack(s, me)).toBe(true);
  });

  test('Crown Opal does 180 and prevents damage from Basic Pokémon (not from evolved ones) during the opponent’s next turn', () => {
    const { s: s0, me, opp } = game(spec, spec, { turn: 3 });
    swapActiveTo(s0, me, TERAPAGOS);
    attach(s0, me, GRASS, 1);
    attach(s0, me, WATER, 1);
    attach(s0, me, LIGHTNING, 1);
    swapActiveTo(s0, opp, FRIGIBAX);
    s0.players[opp].active!.damage = -400;
    const s = attack(s0, 1);
    expect(s.players[opp].active!.damage).toBe(-400 + 180);
    // the opponent's turn: a Basic attacker does nothing, a Stage 1 does
    const basic = swapOpp(s, opp, FRIGIBAX);
    attach(basic, opp, WATER, 1);
    attach(basic, opp, FIGHTING, 1); // Tackle costs {W}{C}
    const hitBasic = attack(basic, 0);
    expect(hitBasic.players[me].active!.damage).toBe(0);
    const evolved = swapOpp(s, opp, FROGADIER);
    attach(evolved, opp, WATER, 2);
    const hitEvolved = attack(evolved, 1);
    expect(hitEvolved.players[me].active!.damage).toBeGreaterThan(0);
  });
});

/** The state `s` with the player's Active Pokémon swapped for `defId` (a copy, so the caller's state is untouched). */
function swapOpp(s: GameState, p: PlayerId, defId: string): GameState {
  const copy = structuredClone(s);
  swapActiveTo(copy, p, defId);
  return copy;
}
