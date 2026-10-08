import { describe, expect, test } from 'vitest';
import type { Action, DeckList, GameState, PlayerId } from '@ptcg/engine';
import { isPlayable } from '../src/playable.ts';
import kangaskhan from '../src/decks/mega-kangaskhan.json';
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
  [ID.megaKangaskhan]: 4,
  [ID.miltank]: 2,
  [ID.stufful]: 2,
  [ID.bewear]: 2,
  [ID.zigzagoon]: 2,
  [ID.linoone]: 2,
  [ID.meowth]: 2,
  [ID.switch]: 2,
  [ID.lightning]: 32,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
/** Coin flips logged after the first `from` log entries. */
const flips = (s: GameState, from: number) =>
  s.log
    .slice(from)
    .filter((e) => e.type === 'coinFlip')
    .map((e) => e.text === 'Coin flip: heads');
const ability = (p: PlayerId, name: string, zone: 'active' | number = 'active'): Action => ({
  type: 'useAbility',
  slot: zone === 'active' ? { player: p, zone: 'active' } : { player: p, zone: 'bench', index: zone },
  ability: name,
});

/** Attack once per seed; returns [flip results, damage dealt] for each seed. */
function runSeeds(attacker: string, index: number, energy: number, seeds = 12) {
  const out: { flips: boolean[]; damage: number }[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const { s: s0, me, opp } = game(spec, spec, { seed });
    swapActiveTo(s0, me, attacker);
    for (let i = 0; i < energy; i++) attachFromDeck(s0, me, ID.lightning);
    swapActiveTo(s0, opp, ID.megaKangaskhan); // no Bench: a Knock Out leaves the Active Spot empty
    const s = attack(s0, index);
    out.push({ flips: flips(s, s0.log.length), damage: s.players[opp].active?.damage ?? 300 });
  }
  return out;
}

describe('Mega Kangaskhan ex', () => {
  test('Run Errand draws 2 while Active; only one Run Errand a turn across your Pokémon', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, ID.megaKangaskhan);
    benchFromHand(s0, me, giveCard(s0, me, ID.megaKangaskhan));
    expect(engine.getLegalActions(s0, me)).not.toContainEqual(ability(me, 'Run Errand', 0));
    const hand = s0.players[me].hand.length;
    const s = act(engine, s0, ability(me, 'Run Errand'));
    expect(s.players[me].hand).toHaveLength(hand + 2);
    const swapped = act(engine, s, { type: 'playTrainer', uid: giveCard(s, me, ID.switch) });
    const after = resolvePrompts(swapped);
    expect(
      engine.getLegalActions(after, me).some((a) => a.type === 'useAbility' && a.ability === 'Run Errand'),
    ).toBe(false);
  });

  test('Rapid-Fire Combo does 200 plus 50 for each heads before the first tails', () => {
    const runs = runSeeds(ID.megaKangaskhan, 0, 3);
    for (const r of runs) {
      expect(r.flips.at(-1)).toBe(false);
      expect(r.flips.slice(0, -1).every(Boolean)).toBe(true);
      expect(r.damage).toBe(Math.min(300, 200 + 50 * (r.flips.length - 1)));
    }
    expect(runs.some((r) => r.flips.length > 1)).toBe(true);
  });
});

describe('Miltank', () => {
  test('Bellyful of Milk heals all damage from one of your Pokémon only on two heads', () => {
    let both = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const { s: s0, me } = game(spec, spec, { seed });
      swapActiveTo(s0, me, ID.miltank);
      attachFromDeck(s0, me, ID.lightning);
      attachFromDeck(s0, me, ID.lightning);
      benchFromHand(s0, me, giveCard(s0, me, ID.stufful));
      s0.players[me].bench[0]!.damage = 50;
      const s = resolvePrompts(attack(s0));
      const f = flips(s, s0.log.length).slice(0, 2);
      const healed = s.players[me].bench[0]!.damage === 0;
      expect(healed).toBe(f[0] === true && f[1] === true);
      if (healed) both++;
    }
    expect(both).toBeGreaterThan(0);
  });
});

describe('Bewear', () => {
  test('Hyper Lariat does 100, or 200 when both coins are heads', () => {
    const runs = runSeeds(ID.bewear, 1, 3, 16);
    for (const r of runs) expect(r.damage).toBe(r.flips[0] && r.flips[1] ? 200 : 100);
    expect(new Set(runs.map((r) => r.damage)).size).toBe(2);
  });
});

describe('Zigzagoon', () => {
  test('Surprise Attack does 30 on heads and nothing on tails', () => {
    const runs = runSeeds(ID.zigzagoon, 0, 1);
    for (const r of runs) expect(r.damage).toBe(r.flips[0] ? 30 : 0);
    expect(new Set(runs.map((r) => r.damage)).size).toBe(2);
  });
});

describe('Meowth', () => {
  test('Fury Swipes does 20 for each heads of 3 coins', () => {
    for (const r of runSeeds(ID.meowth, 0, 2)) {
      expect(r.flips).toHaveLength(3);
      expect(r.damage).toBe(20 * r.flips.filter(Boolean).length);
    }
  });
});

describe('Linoone', () => {
  const setup = (withMega: boolean) => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, withMega ? ID.megaKangaskhan : ID.miltank);
    benchFromHand(s, me, giveCard(s, me, ID.zigzagoon));
    s.players[me].bench[0]!.stack.push(giveCard(s, me, ID.linoone));
    s.players[me].hand.splice(s.players[me].hand.indexOf(s.players[me].bench[0]!.stack[1]!), 1);
    return { s, me };
  };

  test('Excited Dash switches Linoone into the Active Spot when you have a Mega ex', () => {
    const { s: s0, me } = setup(true);
    const s = act(engine, s0, ability(me, 'Excited Dash', 0));
    expect(s.cards[s.players[me].active!.stack.at(-1)!]!.defId).toBe(ID.linoone);
    expect(s.players[me].active!.becameActiveTurn).toBe(s0.turn);
    expect(s.cards[s.players[me].bench[0]!.stack[0]!]!.defId).toBe(ID.megaKangaskhan);
  });

  test('Excited Dash needs a Mega ex in play', () => {
    const { s, me } = setup(false);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(ability(me, 'Excited Dash', 0));
  });
});

test('Mega Kangaskhan ex theme deck: 60 cards, all exist and are playable', () => {
  const deck = kangaskhan as DeckList;
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) {
    expect(registry.defs[c.id], c.id).toBeDefined();
    expect(isPlayable(registry.defs[c.id]!, registry), c.id).toBe(true);
  }
});
