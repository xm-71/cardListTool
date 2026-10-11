import { describe, expect, test } from 'vitest';
import type { Action, GameState, PlayerId } from '@ptcg/engine';
import { act, finishSetup, giveCard, swapActiveTo } from '@ptcg/engine/testing';
import { DECKS, engine } from '../src/game/catalog.ts';
import { targetsFor, untargeted } from '../src/game/targets.ts';

const G = DECKS[0]!.list;
function turn2(): { s: GameState; me: PlayerId } {
  let s = finishSetup(engine, engine.createGame({ decks: [G, G], seed: 3 }));
  s = act(engine, s, { type: 'endTurn' });
  return { s, me: s.current };
}
const legal = (s: GameState, me: PlayerId): Action[] => engine.getLegalActions(s, me);

describe('targetsFor', () => {
  test('an Energy card targets each of your Pokémon, one action per spot', () => {
    const { s, me } = turn2();
    const dark = giveCard(s, me, 'mee-007');
    const spots = targetsFor(legal(s, me), dark);
    const refs = spots.map((t) => t.target);
    expect(refs).toContainEqual({ player: me, zone: 'active' });
    expect(refs).toHaveLength(1 + s.players[me].bench.length);
    for (const t of spots) {
      expect(t.actions).toHaveLength(1);
      expect(t.actions[0]!.type).toBe('attachEnergy');
    }
  });

  test('an evolution targets only the Pokémon it evolves from', () => {
    const { s: s2 } = turn2();
    const s = act(engine, act(engine, s2, { type: 'endTurn' }), { type: 'endTurn' });
    const me = s.current; // a later turn, so evolving is allowed
    swapActiveTo(s, me, 'me02-054'); // Gastly, in play since before this turn
    s.players[me].active!.enteredTurn = 0;
    const haunter = giveCard(s, me, 'me02-055');
    const spots = targetsFor(legal(s, me), haunter);
    expect(spots.map((t) => t.target)).toContainEqual({ player: me, zone: 'active' });
    expect(spots.every((t) => t.actions[0]!.type === 'evolve')).toBe(true);
  });

  test('a Basic Pokémon targets the next empty Bench space', () => {
    const { s, me } = turn2();
    const seviper = giveCard(s, me, 'me02-062');
    const spots = targetsFor(legal(s, me), seviper);
    expect(spots).toEqual([{ target: 'bench', actions: [{ type: 'playBasic', uid: seviper }] }]);
  });

  test('a card that cannot be played has no targets', () => {
    const { s, me } = turn2();
    const haunter = giveCard(s, me, 'me02-055');
    s.players[me].active = null;
    s.players[me].bench = [];
    expect(targetsFor([], haunter)).toEqual([]);
  });
});

describe('untargeted', () => {
  test('a Trainer with no target and a Basic Pokémon have Play actions; Energy has none', () => {
    const { s, me } = turn2();
    const ball = giveCard(s, me, 'sv01-181'); // Nest Ball
    const seviper = giveCard(s, me, 'me02-062');
    const dark = giveCard(s, me, 'mee-007');
    const l = legal(s, me);
    expect(untargeted(l, ball)).toEqual([{ type: 'playTrainer', uid: ball }]);
    expect(untargeted(l, seviper)).toEqual([{ type: 'playBasic', uid: seviper }]);
    expect(untargeted(l, dark)).toEqual([]);
  });
});
