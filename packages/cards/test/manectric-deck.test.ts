import { describe, expect, test } from 'vitest';
import type { DeckList, GameState } from '@ptcg/engine';
import { isPlayable } from '../src/playable.ts';
import manectric from '../src/decks/mega-manectric.json';
import {
  ID,
  act,
  answer,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  has,
  registry,
  swapActiveTo,
} from './helpers.ts';

const spec = {
  [ID.electrike]: 4,
  [ID.megaManectric]: 3,
  [ID.raikou]: 2,
  [ID.yamper]: 2,
  [ID.boltund]: 2,
  [ID.magnemite]: 2,
  [ID.magneton]: 2,
  [ID.lightning]: 30,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const heads = (s: GameState) => s.log.some((e) => e.text === 'Coin flip: heads');

/** Run `setup` with several seeds; returns the damage seen for tails and for heads. */
function byCoin(run: (seed: number) => { s: GameState; damage: number }) {
  const seen: { heads?: number; tails?: number; s?: GameState } = {};
  for (let seed = 1; seed <= 16 && (seen.heads === undefined || seen.tails === undefined); seed++) {
    const { s, damage } = run(seed);
    seen[heads(s) ? 'heads' : 'tails'] = damage;
  }
  return seen;
}

describe('Electrike', () => {
  test('Thunder Jolt does 30 and 10 to itself', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.electrike);
    attachFromDeck(s0, me, ID.lightning);
    swapActiveTo(s0, opp, ID.megaManectric);
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(30);
    expect(s.players[me].active!.damage).toBe(10);
  });
});

describe('Mega Manectric ex', () => {
  const flashRay = (attacker: string) => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.megaManectric);
    attachFromDeck(s0, me, ID.lightning);
    attachFromDeck(s0, me, ID.lightning);
    swapActiveTo(s0, opp, ID.megaManectric); // survives Flash Ray, so the game goes on
    attachFromDeck(s0, opp, ID.lightning);
    attachFromDeck(s0, opp, ID.lightning);
    let s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(120);
    swapActiveTo(s, opp, attacker); // test setup: the opponent now attacks with `attacker`
    s.players[opp].active!.damage = 0;
    s = attack(s);
    return s.players[me].active!.damage;
  };

  test('Flash Ray prevents damage from Basic Pokémon next turn', () => {
    expect(flashRay(ID.raikou)).toBe(0);
  });

  test('Flash Ray does not stop evolved Pokémon', () => {
    expect(flashRay(ID.boltund)).toBeGreaterThan(0);
  });

  const blasting = (choice: 'yes' | 'no') => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.megaManectric);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, ID.lightning);
    swapActiveTo(s0, opp, ID.megaManectric);
    benchFromHand(s0, opp, giveCard(s0, opp, ID.raikou));
    const asked = attack(s0, 1);
    expect(asked.prompt).not.toBeNull();
    return { s: answer(asked, choice), me };
  };

  test('Riotous Blasting: discarding all Energy does 330', () => {
    const { s, me } = blasting('yes');
    expect(s.players[me].active!.energy).toHaveLength(0);
    expect(s.players[me].prizes).toHaveLength(3); // 330 Knocks Out the 330 HP Mega ex: 3 Prizes
  });

  test('Riotous Blasting: keeping the Energy does 200', () => {
    const { s, me } = blasting('no');
    expect(s.players[me].active!.energy).toHaveLength(3);
    expect(s.players[me === 0 ? 1 : 0].active!.damage).toBe(200);
  });
});

describe('Raikou', () => {
  test('Electro Fall does 30, or 120 with at least 4 {L} Energy in play', () => {
    const run = (bench: number) => {
      const { s: s0, me, opp } = game(spec);
      swapActiveTo(s0, me, ID.raikou);
      attachFromDeck(s0, me, ID.lightning);
      attachFromDeck(s0, me, ID.lightning);
      benchFromHand(s0, me, giveCard(s0, me, ID.electrike));
      for (let i = 0; i < bench; i++) attachFromDeck(s0, me, ID.lightning, 0);
      swapActiveTo(s0, opp, ID.megaManectric);
      return attack(s0).players[opp].active!.damage;
    };
    expect(run(1)).toBe(30);
    expect(run(2)).toBe(120);
  });
});

describe.each([
  ['Yamper', ID.yamper, 20, 40],
  ['Boltund', ID.boltund, 70, 140],
] as const)('%s', (_name, id, tails, headsDamage) => {
  test('does more damage on heads', () => {
    const seen = byCoin((seed) => {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, id);
      attachFromDeck(s0, me, ID.lightning);
      attachFromDeck(s0, me, ID.lightning);
      swapActiveTo(s0, opp, ID.megaManectric);
      const s = attack(s0);
      return { s, damage: s.players[opp].active!.damage };
    });
    expect(seen).toMatchObject({ tails, heads: headsDamage });
  });
});

describe('Magneton', () => {
  test('Thunder Shock does 30 and Paralyzes on heads', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 16 && outcomes.size < 2; seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, ID.magneton);
      attachFromDeck(s0, me, ID.lightning);
      swapActiveTo(s0, opp, ID.megaManectric);
      attachFromDeck(s0, opp, ID.lightning);
      attachFromDeck(s0, opp, ID.lightning);
      const s = attack(s0);
      expect(s.players[opp].active!.damage).toBe(30);
      expect(has(engine.getLegalActions(s, opp), 'attack')).toBe(!heads(s));
      outcomes.add(heads(s));
    }
    expect(outcomes.size).toBe(2);
  });
});

test('Mega Manectric ex theme deck: 60 cards, all exist and are playable', () => {
  const deck = manectric as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) {
    expect(registry.defs[c.id], c.id).toBeDefined();
    expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
  }
});
