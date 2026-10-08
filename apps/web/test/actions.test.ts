import { describe, expect, test } from 'vitest';
import type { Action, GameState, PlayerId } from '@ptcg/engine';
import {
  act,
  attachFromDeck,
  benchFromHand,
  finishSetup,
  giveCard,
  swapActiveTo,
} from '@ptcg/engine/testing';
import { actionsForCard, actionsForSlot, describeAction, globalActions } from '../src/game/actions.ts';
import { DECKS, engine } from '../src/game/catalog.ts';

const G = DECKS[0]!.list; // Mega Gengar ex deck in both seats
function turn2(): { s: GameState; me: PlayerId } {
  let s = finishSetup(engine, engine.createGame({ decks: [G, G], seed: 3 }));
  s = act(engine, s, { type: 'endTurn' });
  return { s, me: s.current };
}
const label = (s: GameState, me: PlayerId, a: Action) => describeAction(a, engine.viewFor(s, me));

describe('describeAction', () => {
  test('labels every kind of action', () => {
    const { s, me } = turn2();
    swapActiveTo(s, me, 'me02-054'); // Gastly
    const ball = giveCard(s, me, 'sv01-181');
    const dark = giveCard(s, me, 'mee-007');
    const haunter = giveCard(s, me, 'me02-055');
    const seviper = giveCard(s, me, 'me02-062');
    const balloon = giveCard(s, me, 'me01-166');
    const active = { player: me, zone: 'active' } as const;
    expect(label(s, me, { type: 'playTrainer', uid: ball })).toBe('Play Nest Ball');
    expect(label(s, me, { type: 'playTrainer', uid: balloon, target: active })).toBe(
      'Attach Air Balloon to Gastly',
    );
    expect(label(s, me, { type: 'attachEnergy', uid: dark, target: active })).toBe(
      'Attach Darkness Energy to Gastly',
    );
    expect(label(s, me, { type: 'evolve', uid: haunter, target: active })).toBe('Evolve Gastly into Haunter');
    expect(label(s, me, { type: 'playBasic', uid: seviper })).toBe('Play Seviper');
    expect(label(s, me, { type: 'attack', attackIndex: 0 })).toBe('Attack: Petty Grudge (10)');
    benchFromHand(s, me, seviper);
    expect(label(s, me, { type: 'retreat', benchIndex: 0 })).toBe('Retreat to Seviper');
    expect(label(s, me, { type: 'endTurn' })).toBe('End turn');
    expect(label(s, me, { type: 'concede' })).toBe('Concede');
    expect(label(s, me, { type: 'answer', optionId: 'done' })).toBe('Done');
  });

  test('attack labels show + and × damage suffixes and omit zero damage', () => {
    const { s, me } = turn2();
    swapActiveTo(s, me, 'me02-059'); // Sableye: Cocky Claw 20+
    expect(label(s, me, { type: 'attack', attackIndex: 0 })).toBe('Attack: Cocky Claw (20+)');
    swapActiveTo(s, me, 'me02-067'); // Toxel: Call for Family (no damage)
    expect(label(s, me, { type: 'attack', attackIndex: 0 })).toBe('Attack: Call for Family');
  });

  test('abilities and stadiums are labelled by name', () => {
    const { s, me } = turn2();
    swapActiveTo(s, me, 'me02-068');
    expect(
      label(s, me, { type: 'useAbility', slot: { player: me, zone: 'active' }, ability: 'Sinister Surge' }),
    ).toBe('Use Sinister Surge');
    const ruins = giveCard(s, me, 'me01-127');
    s.players[me].hand.splice(s.players[me].hand.indexOf(ruins), 1);
    s.stadium = { uid: ruins, owner: me };
    expect(label(s, me, { type: 'useStadium' })).toBe('Use Risky Ruins');
  });
});

describe('grouping', () => {
  test('actionsForCard returns the actions for a hand card', () => {
    const { s, me } = turn2();
    const seviper = giveCard(s, me, 'me02-062');
    expect(actionsForCard(engine.getLegalActions(s, me), seviper)).toEqual([
      { type: 'playBasic', uid: seviper },
    ]);
  });

  test('actionsForSlot on the Active includes attacks once Energy is attached, and targeted plays', () => {
    const { s, me } = turn2();
    swapActiveTo(s, me, 'me02-054');
    attachFromDeck(s, me, 'mee-007');
    const dark = giveCard(s, me, 'mee-007');
    const active = { player: me, zone: 'active' } as const;
    const acts = actionsForSlot(engine.getLegalActions(s, me), active, me);
    expect(acts).toContainEqual({ type: 'attack', attackIndex: 0 });
    expect(acts).toContainEqual({ type: 'attachEnergy', uid: dark, target: active });
    expect(acts.every((a) => a.type !== 'endTurn')).toBe(true);
    const oppActive = { player: me === 0 ? 1 : 0, zone: 'active' } as const;
    expect(actionsForSlot(engine.getLegalActions(s, me), oppActive, me)).toEqual([]);
  });

  test('globalActions returns end turn and concede', () => {
    const { s, me } = turn2();
    expect(globalActions(engine.getLegalActions(s, me)).map((a) => a.type)).toEqual(['endTurn', 'concede']);
  });
});
