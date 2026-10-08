import { describe, expect, test } from 'vitest';
import { applyCondition } from '../src/conditions.ts';
import { createEngine } from '../src/engine.ts';
import type { GameState, PlayerId } from '../src/types.ts';
import { act, attachFromDeck, benchFromHand, giveCard, has, miniRegistry, started } from './fixtures.ts';

const engine = createEngine(miniRegistry());

function turn2(): { s: GameState; me: PlayerId; opp: PlayerId } {
  let s = started(engine, undefined, undefined, 11);
  s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  return { s, me, opp: me === 0 ? 1 : 0 };
}

const flips = (s: GameState, from: number) =>
  s.log
    .slice(from)
    .filter((e) => e.type === 'coinFlip')
    .map((e) => e.text.endsWith('heads'));

describe('applyCondition', () => {
  test('Asleep, Confused and Paralyzed replace each other; Poison and Burn stack with them', () => {
    const { s, me } = turn2();
    const slot = s.players[me].active!;
    applyCondition(slot, 'asleep');
    applyCondition(slot, 'poisoned');
    applyCondition(slot, 'confused');
    applyCondition(slot, 'burned');
    expect(slot.conditions).toEqual({ rotation: 'confused', poisoned: true, burned: true });
  });
});

describe('Pokémon Checkup', () => {
  test('Poison places 1 damage counter between turns', () => {
    const { s: s0, me } = turn2();
    applyCondition(s0.players[me].active!, 'poisoned');
    const s = act(engine, s0, { type: 'endTurn' });
    expect(s.players[me].active!.damage).toBe(10);
    expect(s.players[me].active!.conditions.poisoned).toBe(true);
  });

  test('Burn places 2 damage counters, then a heads flip cures it', () => {
    const { s: s0, me } = turn2();
    applyCondition(s0.players[me].active!, 'burned');
    const from = s0.log.length;
    const s = act(engine, s0, { type: 'endTurn' });
    expect(s.players[me].active!.damage).toBe(20);
    const [heads] = flips(s, from);
    expect(s.players[me].active!.conditions.burned).toBe(!heads);
  });

  test('Asleep blocks attacking and retreating; a heads flip at Checkup wakes it up', () => {
    const { s: s0, me } = turn2();
    attachFromDeck(s0, me, 't-dark');
    benchFromHand(s0, me, giveCard(s0, me, 't-basic'));
    applyCondition(s0.players[me].active!, 'asleep');
    const legal = engine.getLegalActions(s0, me);
    expect(has(legal, 'attack')).toBe(false);
    expect(has(legal, 'retreat')).toBe(false);
    const from = s0.log.length;
    const s = act(engine, s0, { type: 'endTurn' });
    const [heads] = flips(s, from);
    expect(s.players[me].active!.conditions.rotation).toBe(heads ? 'none' : 'asleep');
  });

  test('Paralysis blocks attacking and retreating and wears off after its owner’s next turn', () => {
    const { s: s0, me, opp } = turn2();
    applyCondition(s0.players[opp].active!, 'paralyzed');
    let s = act(engine, s0, { type: 'endTurn' }); // end my turn: opponent is still Paralyzed
    expect(s.players[opp].active!.conditions.rotation).toBe('paralyzed');
    attachFromDeck(s, opp, 't-dark');
    expect(has(engine.getLegalActions(s, opp), 'attack')).toBe(false);
    s = act(engine, s, { type: 'endTurn' }); // end the opponent's turn: cured
    expect(s.players[opp].active!.conditions.rotation).toBe('none');
    expect(s.current).toBe(me);
  });

  test('a Knockout during Checkup gives Prizes', () => {
    const { s: s0, me, opp } = turn2();
    applyCondition(s0.players[opp].active!, 'poisoned');
    s0.players[opp].active!.damage = 50;
    benchFromHand(s0, opp, giveCard(s0, opp, 't-basic'));
    benchFromHand(s0, opp, giveCard(s0, opp, 't-basic'));
    let s = act(engine, s0, { type: 'endTurn' });
    expect(s.prompt?.player).toBe(opp); // promote after the Knockout
    s = act(engine, s, { type: 'answer', optionId: s.prompt!.options[0]!.id });
    expect(s.players[opp].active).not.toBeNull();
    expect(s.players[me].prizes).toHaveLength(5);
    expect(s.current).toBe(opp);
  });
});

describe('Confusion', () => {
  test('a Confused attacker flips: tails puts 3 damage counters on itself and the attack does nothing', () => {
    const { s: s0, me, opp } = turn2();
    attachFromDeck(s0, me, 't-dark');
    applyCondition(s0.players[me].active!, 'confused');
    const from = s0.log.length;
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    const [heads] = flips(s, from);
    if (heads) {
      expect(s.players[opp].active!.damage).toBe(20);
      expect(s.players[me].active!.damage).toBe(0);
    } else {
      expect(s.players[opp].active!.damage).toBe(0);
      expect(s.players[me].active!.damage).toBe(30);
    }
  });
});

describe('clearing conditions', () => {
  test('retreating and evolving clear special conditions', () => {
    const { s: s0, me } = turn2();
    attachFromDeck(s0, me, 't-dark');
    benchFromHand(s0, me, giveCard(s0, me, 't-basic'));
    applyCondition(s0.players[me].active!, 'confused');
    applyCondition(s0.players[me].active!, 'poisoned');
    const s = act(engine, s0, { type: 'retreat', benchIndex: 0 });
    expect(s.players[me].bench[0]!.conditions).toEqual({ rotation: 'none', poisoned: false, burned: false });

    let t = turn2().s;
    const p = t.current;
    t = act(engine, t, { type: 'endTurn' });
    t = act(engine, t, { type: 'endTurn' }); // p's second turn: the Active can evolve
    const evo = giveCard(t, p, 't-evo');
    applyCondition(t.players[p].active!, 'burned');
    t = act(engine, t, { type: 'evolve', uid: evo, target: { player: p, zone: 'active' } });
    expect(t.players[p].active!.conditions).toEqual({ rotation: 'none', poisoned: false, burned: false });
  });
});
