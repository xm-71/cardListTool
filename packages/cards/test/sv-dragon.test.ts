import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  act,
  attachFromDeck,
  benchFromHand,
  defIdsOf,
  engine,
  game,
  giveCard,
  swapActiveTo,
} from './helpers.ts';

const RAGING_BOLT = 'sv05-123';
const FRIGIBAX = 'sv02-057';
const LIGHTNING = 'mee-004';
const FIGHTING = 'mee-006';
const GROWING_GRASS = 'me03-086'; // a Special Energy
const spec = {
  [RAGING_BOLT]: 3,
  [FRIGIBAX]: 6,
  [GROWING_GRASS]: 2,
  [LIGHTNING]: 10,
  [FIGHTING]: 10,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const emptyHand = (s: GameState, p: PlayerId) => s.players[p].deck.push(...s.players[p].hand.splice(0));
const neutral = (s: GameState, opp: PlayerId) => {
  swapActiveTo(s, opp, FRIGIBAX);
  s.players[opp].active!.damage = -1000;
};

describe('Raging Bolt ex', () => {
  test('Burst Roar discards the hand and draws 6 cards', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, RAGING_BOLT);
    attachFromDeck(s0, me, LIGHTNING);
    const before = [...s0.players[me].hand];
    const s = attack(s0, 0);
    expect(s.players[me].hand).toHaveLength(6);
    for (const uid of before) expect(s.players[me].discard).toContain(uid);
  });

  test('Burst Roar with an empty hand just draws 6', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, RAGING_BOLT);
    attachFromDeck(s0, me, LIGHTNING);
    emptyHand(s0, me);
    expect(attack(s0, 0).players[me].hand).toHaveLength(6);
  });

  /** Raging Bolt ex Active with `active` Basic Energy and one Benched Pokémon holding `bench` more; `special` Growing Grass on the Bench. */
  const setup = (active: [number, number], bench: number, special = 0) => {
    const { s, me, opp } = game(spec);
    swapActiveTo(s, me, RAGING_BOLT);
    for (let i = 0; i < active[0]; i++) attachFromDeck(s, me, LIGHTNING);
    for (let i = 0; i < active[1]; i++) attachFromDeck(s, me, FIGHTING);
    benchFromHand(s, me, giveCard(s, me, FRIGIBAX));
    for (let i = 0; i < bench; i++) {
      const uid = s.players[me].deck.find((u) => s.cards[u]!.defId === FIGHTING)!;
      s.players[me].deck.splice(s.players[me].deck.indexOf(uid), 1);
      s.players[me].bench[0]!.energy.push(uid);
    }
    for (let i = 0; i < special; i++) {
      const uid = s.players[me].deck.find((u) => s.cards[u]!.defId === GROWING_GRASS)!;
      s.players[me].deck.splice(s.players[me].deck.indexOf(uid), 1);
      s.players[me].bench[0]!.energy.push(uid);
    }
    neutral(s, opp);
    return { s, me, opp };
  };

  test('Bellowing Thunder asks "70 damage each" and does 70 for each Basic Energy discarded, from any of your Pokémon', () => {
    const { s: s0, me, opp } = setup([1, 2], 2);
    let s = attack(s0, 1);
    expect(s.prompt!.message).toContain('70 damage each'); // the bots read the amount from this text
    expect(s.prompt!.options).toHaveLength(5); // 3 on the Active, 2 on the Bench
    const bench = s.prompt!.options.filter((o) => s.players[me].bench[0]!.energy.includes(o.uid!));
    const active = s.prompt!.options.filter((o) => s.players[me].active!.energy.includes(o.uid!));
    for (const o of [active[0]!, active[1]!, bench[0]!]) s = act(engine, s, { type: 'answer', optionId: o.id });
    s = act(engine, s, { type: 'answer', optionId: 'done' });
    expect(s.players[opp].active!.damage).toBe(-1000 + 210);
    expect(s.players[me].active!.energy).toHaveLength(1);
    expect(s.players[me].bench[0]!.energy).toHaveLength(1);
  });

  test('Bellowing Thunder does 0 when no Energy is discarded, and never offers Special Energy', () => {
    const { s: s0, me, opp } = setup([1, 1], 0, 2);
    let s = attack(s0, 1);
    expect(s.prompt!.options).toHaveLength(2); // the Growing Grass Energy on the Bench is not offered
    const offered = defIdsOf(s, s.prompt!.options.map((o) => o.uid!));
    expect(offered).not.toContain(GROWING_GRASS);
    s = act(engine, s, { type: 'answer', optionId: 'done' });
    expect(s.players[opp].active!.damage).toBe(-1000); // 70 for each card discarded: none, none
    expect(s.players[me].active!.energy).toHaveLength(2);
  });
});
