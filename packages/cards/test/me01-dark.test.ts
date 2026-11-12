import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  act,
  answerCards,
  attachFromDeck,
  benchFromHand,
  defIdsOf,
  engine,
  game,
  giveCard,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const MEGA_ABSOL = 'me01-086';
const FRIGIBAX = 'sv02-057'; // 60 HP, Water
const ARTAZON = 'sv02-171';
const DARK = 'mee-007';
const spec = { [MEGA_ABSOL]: 4, [FRIGIBAX]: 6, [ARTAZON]: 2, [DARK]: 24 };
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: PlayerId, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, DARK);
};
const emptyHand = (s: GameState, p: PlayerId) => s.players[p].deck.push(...s.players[p].hand.splice(0));

describe('Mega Absol ex', () => {
  /** Mega Absol ex attacks a (second) Mega Absol ex with `damage` on it: 280 HP, so 60 is exactly 6 damage counters. */
  const terminal = (damage: number) => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, MEGA_ABSOL);
    attach(s0, me, 2);
    swapActiveTo(s0, opp, MEGA_ABSOL);
    s0.players[opp].active!.damage = damage;
    benchFromHand(s0, opp, giveCard(s0, opp, FRIGIBAX));
    const old = s0.players[opp].active!.stack[0]!;
    return { s: resolvePrompts(attack(s0, 0)), me, opp, old };
  };

  test('Terminal Period Knocks Out a Defending Pokémon with exactly 6 damage counters on it', () => {
    const { s, me, opp, old } = terminal(60);
    expect(s.players[opp].discard).toContain(old);
    expect(s.players[me].prizes).toHaveLength(3); // a Mega ex is worth 3 Prizes
  });

  test.each([50, 70, 0])('Terminal Period does nothing to a Defending Pokémon with %i damage', (damage) => {
    const { s, opp, old } = terminal(damage);
    expect(s.players[opp].active!.stack[0]).toBe(old);
    expect(s.players[opp].active!.damage).toBe(damage);
  });

  test('Claw of Darkness does 200, reveals the hand and the attacker’s owner discards a card they choose from it', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, MEGA_ABSOL);
    attach(s0, me, 3);
    swapActiveTo(s0, opp, FRIGIBAX);
    s0.players[opp].active!.damage = -400;
    emptyHand(s0, opp);
    for (const id of [FRIGIBAX, FRIGIBAX, ARTAZON]) giveCard(s0, opp, id);
    const s1 = attack(s0, 1);
    expect(s1.prompt!.player).toBe(me); // the attacker picks
    expect(new Set(defIdsOf(s1, s1.prompt!.options.map((o) => o.uid!)))).toEqual(new Set([FRIGIBAX, ARTAZON]));
    const s = answerCards(s1, [ARTAZON]);
    expect(s.log.some((e) => e.type === 'reveal')).toBe(true);
    const left = defIdsOf(s, s.players[opp].hand);
    expect(left.filter((d) => d === FRIGIBAX)).toHaveLength(2);
    expect(left).not.toContain(ARTAZON);
    expect(left).toHaveLength(3); // the 2 left, and the card drawn for their turn
    expect(defIdsOf(s, s.players[opp].discard)).toContain(ARTAZON);
    expect(s.players[opp].active!.damage).toBe(-400 + 200);
  });

  test('Claw of Darkness with an empty hand just does damage', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, MEGA_ABSOL);
    attach(s0, me, 3);
    swapActiveTo(s0, opp, FRIGIBAX);
    s0.players[opp].active!.damage = -400;
    emptyHand(s0, opp);
    const s = attack(s0, 1);
    expect(s.prompt).toBeNull();
    expect(s.players[opp].active!.damage).toBe(-400 + 200);
  });
});
