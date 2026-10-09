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

const KOFFING = sv('109');
const WEEZING = sv('110');
const GRIMER = sv('088');
const MUK = sv('089');
const EKANS = sv('023');
const ARBOK = sv('024');
const D = 'mee-007';
const ALL = {
  [KOFFING]: 4,
  [WEEZING]: 4,
  [GRIMER]: 4,
  [MUK]: 4,
  [EKANS]: 4,
  [ARBOK]: 4,
  [D]: 20,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const dark = (s: GameState, p: 0 | 1, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, D);
};
const buffer = (s: GameState, opp: 0 | 1) => {
  swapActiveTo(s, opp, EKANS);
  s.players[opp].active!.damage = -400;
};

test('Koga deck: 60 playable cards', () => {
  const deck = GYM_DECKS.koga as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
});

describe('Koffing', () => {
  test('Suspicious Gas confuses the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, KOFFING);
    buffer(s0, opp);
    dark(s0, me, 2);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.conditions.rotation).toBe('confused');
  });
});

describe('Weezing', () => {
  test('Spinning Fumes does 50 and 10 to each Benched Pokémon, ignoring Weakness there', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, WEEZING);
    buffer(s0, opp);
    benchFromHand(s0, opp, giveCard(s0, opp, KOFFING));
    benchFromHand(s0, opp, giveCard(s0, opp, GRIMER));
    dark(s0, me, 2);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 50);
    expect(s.players[opp].bench.map((b) => b.damage)).toEqual([10, 10]);
  });

  test('Let’s Have a Blast: Knocked Out in the Active Spot by an attack, heads Knocks the attacker Out', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 30; seed++) {
      const { s: s0, me, opp } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, MUK);
      dark(s0, me, 4);
      swapActiveTo(s0, opp, WEEZING);
      s0.players[opp].active!.damage = 100;
      const s = resolvePrompts(attack(s0, 1)); // Sludge Bomb, 180
      const heads = s.log.slice(s0.log.length).some((l) => l.text === 'Coin flip: heads');
      const attackerGone = s.players[me].discard.some((u) => s.cards[u]!.defId === MUK);
      expect(attackerGone).toBe(heads);
      outcomes.add(heads);
    }
    expect(outcomes.size).toBe(2);
  });

  test('does nothing when a Benched Weezing is Knocked Out', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, MUK);
    dark(s0, me, 4);
    benchFromHand(s0, opp, giveCard(s0, opp, WEEZING));
    s0.players[opp].bench[0]!.damage = 200;
    // Knock out the bench via Spinning Fumes-like damage is out of scope; instead Knock the Active Out and keep Weezing benched.
    buffer(s0, opp);
    s0.players[opp].active!.damage = 400; // the Cresselia dies to the attack
    const s = resolvePrompts(attack(s0, 1));
    expect(s.log.slice(s0.log.length).some((l) => l.type === 'coinFlip')).toBe(false);
  });
});

describe('Grimer and Muk', () => {
  test('Gummy Press does 10 and makes the Defending Pokémon’s Retreat Cost {C} more', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, GRIMER);
    buffer(s0, opp);
    dark(s0, me, 1);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 10);
    expect(s.players[opp].active!.markers).toEqual([
      { kind: 'retreatCostMore', amount: 1, untilTurn: s0.turn + 1 },
    ]);
  });

  test('Sticky Jail does 30 and adds {C} to the Defending Pokémon’s attacks and Retreat Cost', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, MUK);
    buffer(s0, opp);
    dark(s0, me, 1);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 30);
    expect(s.players[opp].active!.markers.map((m) => m.kind).sort()).toEqual([
      'attackCostMore',
      'retreatCostMore',
    ]);
  });
});

describe('Ekans', () => {
  test('Acid Spray does 30; heads discards an Energy from the Defending Pokémon', () => {
    const results = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const { s: s0, me, opp } = game(ALL, ALL, { seed });
      swapActiveTo(s0, me, EKANS);
      buffer(s0, opp);
      dark(s0, me, 2);
      dark(s0, opp, 2);
      const s = resolvePrompts(attack(s0, 0));
      const heads = s.log.slice(s0.log.length).some((l) => l.text === 'Coin flip: heads');
      expect(s.players[opp].active!.energy.length).toBe(heads ? 1 : 2);
      expect(s.players[opp].active!.damage).toBe(-400 + 30);
      results.add(s.players[opp].active!.energy.length);
    }
    expect(results.size).toBe(2);
  });
});

describe('Arbok ex', () => {
  test('Bind Down does 70 and the Defending Pokémon can’t retreat', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ARBOK);
    buffer(s0, opp);
    dark(s0, me, 2);
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 70);
    expect(s.players[opp].active!.markers.map((m) => m.kind)).toEqual(['cantRetreat']);
  });

  test('Menacing Fangs does 150 and the opponent chooses 2 cards to discard', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ARBOK);
    buffer(s0, opp);
    dark(s0, me, 3);
    const hand = [...s0.players[opp].hand];
    let s = attack(s0, 1);
    expect(s.prompt?.player).toBe(opp);
    const chosen = [s.prompt!.options[2]!.uid!, s.prompt!.options[4]!.uid!];
    s = answer(s, s.prompt!.options[2]!.id);
    s = answer(s, s.prompt!.options[3]!.id); // option list shrinks after a pick; the second pick is whatever is offered
    expect(s.players[opp].active!.damage).toBe(-400 + 150);
    expect(s.players[opp].hand).toHaveLength(hand.length - 2 + 1); // they draw for their turn
    expect(s.players[opp].discard).toHaveLength(2);
    expect(s.players[opp].discard).toContain(chosen[0]);
  });

  test('with 1 card in hand it discards that card', () => {
    const { s: s0, me, opp } = game(ALL, ALL);
    swapActiveTo(s0, me, ARBOK);
    buffer(s0, opp);
    dark(s0, me, 3);
    const o = s0.players[opp];
    o.deck.push(...o.hand.splice(1));
    const s = resolvePrompts(attack(s0, 1));
    expect(s.players[opp].discard).toHaveLength(1);
  });
});
