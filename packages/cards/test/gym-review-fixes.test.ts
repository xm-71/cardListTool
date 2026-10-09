import { describe, expect, test } from 'vitest';
import type { GameState } from '@ptcg/engine';
import {
  act,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  resolvePrompts,
  sv,
  swapActiveTo,
} from './helpers.ts';

const RAPIDASH = sv('078');
const PONYTA = sv('077');
const WEEZING = sv('110');
const KOFFING = sv('109');
const MACHAMP = sv('068');
const MACHOP = sv('066');
const DEWGONG = sv('087');
const SEEL = sv('086');
const ARTICUNO = sv('144');
const PIKACHU = sv('025');
const RAICHU = sv('026');
const DRAGONAIR = sv('148');
const R = 'mee-002';
const W = 'mee-003';
const L = 'mee-004';
const F = 'mee-006';
const D = 'mee-007';
const ALL = {
  [RAPIDASH]: 4,
  [PONYTA]: 4,
  [WEEZING]: 4,
  [KOFFING]: 4,
  [MACHAMP]: 4,
  [MACHOP]: 4,
  [DEWGONG]: 4,
  [SEEL]: 4,
  [ARTICUNO]: 4,
  [PIKACHU]: 4,
  [RAICHU]: 4,
  [DRAGONAIR]: 4,
  [R]: 6,
  [W]: 6,
  [L]: 6,
  [F]: 6,
  [D]: 6,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: 0 | 1, id: string, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, id);
};
const names = (s: GameState, p: 0 | 1) =>
  [s.players[p].active, ...s.players[p].bench].filter(Boolean).map((sl) => s.cards[sl!.stack.at(-1)!]!.defId);

describe('attack bookkeeping follows a Pokémon that the attack switches', () => {
  test('Weezing’s reaction Knocks Out Rapidash (the attacker), not the Pokémon it switched in', () => {
    let heads = 0;
    for (let seed = 1; seed <= 30 && heads < 3; seed++) {
      const { s: s0, me, opp } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, RAPIDASH);
      attach(s0, me, R, 3);
      benchFromHand(s0, me, giveCard(s0, me, PONYTA));
      swapActiveTo(s0, opp, WEEZING);
      benchFromHand(s0, opp, giveCard(s0, opp, KOFFING));
      s0.players[opp].active!.damage = 50;
      const s = resolvePrompts(attack(s0, 1)); // Mach Turn: 90, then switch with Ponyta
      const flip = s.log.slice(s0.log.length).find((l) => l.type === 'coinFlip');
      if (flip?.text !== 'Coin flip: heads') continue;
      heads++;
      expect(s.players[me].discard.some((u) => s.cards[u]!.defId === RAPIDASH)).toBe(true);
      expect(names(s, me)).toContain(PONYTA);
    }
    expect(heads).toBeGreaterThan(0);
  });
});

describe('Benched damage counts as attack damage', () => {
  test('Dewgong’s Dual Splash on a Benched Machamp gives Guts its flip', () => {
    let sawFlip = false;
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, DEWGONG);
    attach(s0, me, W, 2);
    swapActiveTo(s0, opp, SEEL);
    s0.players[opp].active!.damage = -400;
    s0.players[opp].bench = [];
    benchFromHand(s0, opp, giveCard(s0, opp, MACHAMP));
    s0.players[opp].bench[0]!.damage = 150; // 180 HP: 50 more would Knock it Out
    const s = resolvePrompts(attack(s0, 0)); // both of their Pokémon are the 2 targets
    sawFlip = s.log.slice(s0.log.length).some((l) => l.type === 'coinFlip');
    expect(sawFlip).toBe(true);
  });

  test('Articuno’s Blizzard Knocking Out a Benched Pikachu triggers Raichu’s Electrical Grounding', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ARTICUNO);
    attach(s0, me, W, 3);
    swapActiveTo(s0, opp, SEEL);
    s0.players[opp].active!.damage = -400;
    s0.players[opp].bench = [];
    benchFromHand(s0, opp, giveCard(s0, opp, PIKACHU));
    benchFromHand(s0, opp, giveCard(s0, opp, RAICHU));
    const pika = s0.players[opp].bench[0]!;
    pika.damage = 50; // 60 HP
    attachFromDeck(s0, opp, L);
    pika.energy.push(s0.players[opp].active!.energy.pop()!);
    const s = attack(s0, 0);
    expect(s.prompt?.player).toBe(opp); // Raichu offers to take the {L} Energy
  });
});

describe('Dragonair’s Aqua Slash', () => {
  test('stops Dragonair attacking at all during your next turn', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, DRAGONAIR);
    attach(s0, me, W, 1);
    attach(s0, me, L, 1);
    swapActiveTo(s0, opp, SEEL);
    s0.players[opp].active!.damage = -400;
    let s = attack(s0, 1);
    s = act(engine, s, { type: 'endTurn' });
    expect(engine.getLegalActions(s, me).some((a) => a.type === 'attack')).toBe(false);
  });
});
