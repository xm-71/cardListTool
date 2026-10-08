import { describe, expect, test } from 'vitest';
import type { DeckList, GameState, PlayerId } from '@ptcg/engine';
import { isPlayable } from '../src/playable.ts';
import lopunny from '../src/decks/mega-lopunny.json';
import {
  ID,
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

const spec = {
  [ID.buneary]: 4,
  [ID.megaLopunny]: 3,
  [ID.lopunny]: 2,
  [ID.jigglypuff]: 2,
  [ID.wigglytuff]: 3,
  [ID.megaKangaskhan]: 2,
  [ID.switch]: 2,
  [ID.lightning]: 42,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
/** Put `evo` on top of a Benched copy of `basic` (test setup). */
function benchEvolved(s: GameState, p: PlayerId, basic: string, evo: string) {
  benchFromHand(s, p, giveCard(s, p, basic));
  const slot = s.players[p].bench.at(-1)!;
  const uid = giveCard(s, p, evo);
  s.players[p].hand.splice(s.players[p].hand.indexOf(uid), 1);
  slot.stack.push(uid);
  return slot;
}

describe('Buneary', () => {
  test('Charm makes the Defending Pokémon do 20 less damage next turn', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.buneary);
    attachFromDeck(s0, me, ID.lightning);
    swapActiveTo(s0, opp, ID.megaKangaskhan);
    const s = attack(s0);
    expect(s.players[opp].active!.markers).toEqual([
      { kind: 'reduceOutgoing', amount: 20, untilTurn: s0.turn + 1 },
    ]);
  });
});

describe('Mega Lopunny ex', () => {
  const galeThrust = (moved: boolean) => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, opp, ID.megaKangaskhan);
    let s = s0;
    if (moved) {
      benchEvolved(s, me, ID.buneary, ID.megaLopunny);
      attachFromDeck(s, me, ID.lightning, 0);
      s = resolvePrompts(act(engine, s, { type: 'playTrainer', uid: giveCard(s, me, ID.switch) }));
    } else {
      swapActiveTo(s, me, ID.megaLopunny);
      attachFromDeck(s, me, ID.lightning);
    }
    return attack(s).players[opp].active!.damage;
  };

  test('Gale Thrust does 230 if it moved from the Bench to the Active Spot this turn', () => {
    expect(galeThrust(true)).toBe(230);
  });

  test('Gale Thrust does 60 otherwise', () => {
    expect(galeThrust(false)).toBe(60);
  });

  test('Spiky Hopper ignores effects on the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.megaLopunny);
    attachFromDeck(s0, me, ID.lightning);
    attachFromDeck(s0, me, ID.lightning);
    swapActiveTo(s0, opp, ID.megaKangaskhan);
    s0.players[opp].active!.markers.push({ kind: 'reduceIncoming', amount: 30, untilTurn: s0.turn + 1 });
    expect(attack(s0, 1).players[opp].active!.damage).toBe(160);
  });
});

describe('Lopunny', () => {
  test('Dashing Kick does 50 to one of the opponent’s Benched Pokémon', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.lopunny);
    attachFromDeck(s0, me, ID.lightning);
    benchFromHand(s0, opp, giveCard(s0, opp, ID.jigglypuff));
    const s = resolvePrompts(attack(s0));
    expect(s.players[opp].bench[0]!.damage).toBe(50);
    expect(s.players[opp].active!.damage).toBe(0);
  });

  test('Dashing Kick does nothing without an opposing Bench', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.lopunny);
    attachFromDeck(s0, me, ID.lightning);
    s0.players[opp].bench = [];
    const s = resolvePrompts(attack(s0));
    expect(s.players[opp].active!.damage).toBe(0);
  });
});

describe('Jigglypuff', () => {
  test('Ball Roll does 20 for each heads before the first tails', () => {
    let sawHeads = false;
    for (let seed = 1; seed <= 12; seed++) {
      const { s: s0, me, opp } = game(spec, spec, { seed });
      swapActiveTo(s0, me, ID.jigglypuff);
      attachFromDeck(s0, me, ID.lightning);
      swapActiveTo(s0, opp, ID.megaKangaskhan);
      const s = attack(s0);
      const f = s.log
        .slice(s0.log.length)
        .filter((e) => e.type === 'coinFlip')
        .map((e) => e.text.endsWith('heads'));
      expect(f.at(-1)).toBe(false);
      expect(s.players[opp].active!.damage).toBe(20 * (f.length - 1));
      sawHeads ||= f.length > 1;
    }
    expect(sawHeads).toBe(true);
  });
});

describe('Wigglytuff', () => {
  test('Round does 40 for each of your Pokémon in play with Round', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ID.jigglypuff);
    s0.players[me].active!.stack.push(giveCard(s0, me, ID.wigglytuff));
    s0.players[me].hand.splice(s0.players[me].hand.indexOf(s0.players[me].active!.stack[1]!), 1);
    attachFromDeck(s0, me, ID.lightning);
    attachFromDeck(s0, me, ID.lightning);
    benchEvolved(s0, me, ID.jigglypuff, ID.wigglytuff);
    benchFromHand(s0, me, giveCard(s0, me, ID.buneary));
    swapActiveTo(s0, opp, ID.megaKangaskhan);
    expect(attack(s0).players[opp].active!.damage).toBe(80);
  });
});

test('Mega Lopunny ex theme deck: 60 cards, all exist and are playable', () => {
  const deck = lopunny as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) {
    expect(registry.defs[c.id], c.id).toBeDefined();
    expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
  }
});
