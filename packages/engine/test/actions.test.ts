import { describe, expect, test } from 'vitest';
import { createEngine } from '../src/engine.ts';
import { canPayCost, getRetreatCost } from '../src/energy.ts';
import { IllegalActionError } from '../src/errors.ts';
import { checkInvariants } from '../src/invariants.ts';
import { act, attachFromDeck, benchFromHand, giveCard, has, miniRegistry, started } from './fixtures.ts';

const engine = createEngine(miniRegistry());

describe('first turn', () => {
  test('the first player can play Basics, attach and end the turn, but not attack or evolve', () => {
    const s = started(engine);
    const me = s.current;
    giveCard(s, me, 't-basic');
    giveCard(s, me, 't-evo');
    giveCard(s, me, 't-dark');
    const legal = engine.getLegalActions(s, me);
    expect(has(legal, 'playBasic')).toBe(true);
    expect(has(legal, 'attachEnergy')).toBe(true);
    expect(has(legal, 'endTurn')).toBe(true);
    expect(has(legal, 'attack')).toBe(false);
    expect(has(legal, 'evolve')).toBe(false);
    expect(engine.getLegalActions(s, me === 0 ? 1 : 0)).toEqual([]);
  });
});

describe('energy attachment', () => {
  test('only one Energy can be attached from hand per turn', () => {
    let s = started(engine);
    const me = s.current;
    const e1 = giveCard(s, me, 't-dark');
    const e2 = giveCard(s, me, 't-dark');
    s = act(engine, s, { type: 'attachEnergy', uid: e1, target: { player: me, zone: 'active' } });
    expect(s.players[me].active!.energy).toEqual([e1]);
    const second = { type: 'attachEnergy', uid: e2, target: { player: me, zone: 'active' } } as const;
    expect(engine.getLegalActions(s, me)).not.toContainEqual(second);
    expect(() => engine.applyAction(s, me, second)).toThrow(IllegalActionError);
  });
});

describe('Bench', () => {
  test('a Basic cannot be played onto a full Bench', () => {
    const s = started(engine);
    const me = s.current;
    for (let i = 0; i < 5; i++) benchFromHand(s, me, giveCard(s, me, 't-basic'));
    giveCard(s, me, 't-basic');
    expect(has(engine.getLegalActions(s, me), 'playBasic')).toBe(false);
  });

  test('playing a Basic puts it on the Bench', () => {
    let s = started(engine);
    const me = s.current;
    const uid = giveCard(s, me, 't-basic');
    s = act(engine, s, { type: 'playBasic', uid });
    expect(s.players[me].bench.map((b) => b.stack[0])).toContain(uid);
    expect(s.players[me].bench.at(-1)!.enteredTurn).toBe(1);
    expect(checkInvariants(s, engine.registry)).toEqual([]);
  });
});

describe('evolution', () => {
  test('a Pokémon put into play this turn cannot evolve; it can on its owner’s next turn', () => {
    let s = started(engine);
    const me = s.current;
    const basic = giveCard(s, me, 't-basic');
    const evo = giveCard(s, me, 't-evo');
    s = act(engine, s, { type: 'endTurn' }); // opponent's turn 2
    s = act(engine, s, { type: 'endTurn' }); // back to me, turn 3
    s = act(engine, s, { type: 'playBasic', uid: basic });
    const benchIndex = s.players[me].bench.length - 1;
    const evolveBenched = {
      type: 'evolve',
      uid: evo,
      target: { player: me, zone: 'bench', index: benchIndex },
    };
    expect(engine.getLegalActions(s, me)).not.toContainEqual(evolveBenched);
    // the Active was placed during setup, so it can evolve now
    expect(engine.getLegalActions(s, me)).toContainEqual({
      type: 'evolve',
      uid: evo,
      target: { player: me, zone: 'active' },
    });
    s = act(engine, s, { type: 'endTurn' });
    s = act(engine, s, { type: 'endTurn' });
    expect(engine.getLegalActions(s, me)).toContainEqual(evolveBenched);
    s = act(engine, s, evolveBenched as never);
    expect(s.players[me].bench[benchIndex]!.stack).toEqual([basic, evo]);
    expect(s.players[me].bench[benchIndex]!.evolvedTurn).toBe(s.turn);
  });
});

describe('retreat', () => {
  test('with a choice of Energy to discard, retreating prompts and then swaps Active and Bench', () => {
    let s = started(engine);
    const me = s.current;
    benchFromHand(s, me, giveCard(s, me, 't-basic'));
    const oldActive = s.players[me].active!.stack[0];
    const benched = s.players[me].bench[0]!.stack[0];
    attachFromDeck(s, me, 't-dark');
    attachFromDeck(s, me, 't-psy');
    s = act(engine, s, { type: 'retreat', benchIndex: 0 });
    expect(s.prompt?.player).toBe(me);
    expect(s.prompt?.options).toHaveLength(2);
    s = act(engine, s, { type: 'answer', optionId: s.prompt!.options[0]!.id });
    expect(s.prompt).toBeNull();
    expect(s.players[me].active!.stack[0]).toBe(benched);
    expect(s.players[me].bench[0]!.stack[0]).toBe(oldActive);
    expect(s.players[me].bench[0]!.energy).toHaveLength(1);
    expect(s.players[me].discard).toHaveLength(1);
    expect(s.players[me].retreatTurn).toBe(s.turn);
    expect(has(engine.getLegalActions(s, me), 'retreat')).toBe(false);
  });

  test('retreat is not legal without enough Energy', () => {
    const s = started(engine);
    const me = s.current;
    benchFromHand(s, me, giveCard(s, me, 't-basic'));
    expect(getRetreatCost(s, { player: me, zone: 'active' }, engine.registry)).toBe(1);
    expect(has(engine.getLegalActions(s, me), 'retreat')).toBe(false);
  });
});

describe('canPayCost', () => {
  test('typed symbols need matching Energy; Colorless takes any', () => {
    const s = started(engine);
    const d = attachFromDeck(s, 0, 't-dark');
    const p = attachFromDeck(s, 0, 't-psy');
    expect(canPayCost(['Darkness', 'Colorless'], [d, p], s, engine.registry)).toBe(true);
    expect(canPayCost(['Darkness', 'Darkness'], [d, p], s, engine.registry)).toBe(false);
    expect(canPayCost(['Colorless', 'Colorless', 'Colorless'], [d, p], s, engine.registry)).toBe(false);
    expect(canPayCost([], [], s, engine.registry)).toBe(true);
  });
});

describe('turns', () => {
  test('ending the turn passes play to the opponent, who draws a card', () => {
    let s = started(engine);
    const me = s.current;
    const opp = me === 0 ? 1 : 0;
    const handBefore = s.players[opp].hand.length;
    s = act(engine, s, { type: 'endTurn' });
    expect(s.current).toBe(opp);
    expect(s.turn).toBe(2);
    expect(s.players[opp].hand).toHaveLength(handBefore + 1);
  });

  test('a player who cannot draw at the start of their turn loses', () => {
    let s = started(engine);
    const me = s.current;
    const opp = me === 0 ? 1 : 0;
    s.players[opp].discard.push(...s.players[opp].deck.splice(0));
    s = act(engine, s, { type: 'endTurn' });
    expect(s.result).toEqual({ winner: me, reason: 'deckOut' });
    expect(s.phase).toBe('gameOver');
  });

  test('conceding hands the win to the opponent', () => {
    let s = started(engine);
    const me = s.current;
    s = act(engine, s, { type: 'concede' });
    expect(s.result).toEqual({ winner: me === 0 ? 1 : 0, reason: 'concede' });
  });

  test('an illegal action throws and leaves the input state untouched', () => {
    const s = started(engine);
    const me = s.current;
    const before = JSON.stringify(s);
    expect(() => engine.applyAction(s, me, { type: 'attack', attackIndex: 0 })).toThrow(IllegalActionError);
    expect(() => engine.applyAction(s, me === 0 ? 1 : 0, { type: 'endTurn' })).toThrow(IllegalActionError);
    expect(JSON.stringify(s)).toBe(before);
  });
});
