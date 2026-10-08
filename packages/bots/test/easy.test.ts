import { describe, expect, test } from 'vitest';
import { createEngine, type Action } from '@ptcg/engine';
import { buildRegistry, megaDiancieDeck, megaGengarDeck } from '@ptcg/cards';
import { act, attachFromDeck, swapActiveTo } from '@ptcg/engine/testing';
import { createEasyBot } from '../src/easy.ts';

const registry = buildRegistry();
const engine = createEngine(registry);
const bot = createEasyBot(registry);

function turn2() {
  let s = engine.createGame({ decks: [megaGengarDeck, megaDiancieDeck], seed: 4 });
  while (s.prompt) {
    const p = s.prompt.player;
    s = act(engine, s, bot(engine.viewFor(s, p), engine.getLegalActions(s, p), 1).action);
  }
  s = act(engine, s, { type: 'endTurn' });
  return s;
}

describe('easy bot', () => {
  test('picks an attack that Knocks Out the Defending Pokémon over one that does not', () => {
    const s = turn2();
    const me = s.current;
    const opp = me === 0 ? 1 : 0;
    const myId = me === 0 ? 'me02-069' : 'me02-045'; // Eternatus (Gengar deck) or Zacian (Diancie deck)
    swapActiveTo(s, me, myId);
    for (let i = 0; i < 3; i++) attachFromDeck(s, me, me === 0 ? 'mee-007' : 'mee-005');
    const defender = s.players[opp].active!;
    const hp = (registry.defs[s.cards[defender.stack[0]!]!.defId] as { hp: number }).hp;
    defender.damage = hp - 10;
    const legal: Action[] = [
      { type: 'endTurn' },
      ...engine.getLegalActions(s, me).filter((a) => a.type === 'attack'),
    ];
    const { action } = bot(engine.viewFor(s, me), legal, 7);
    expect(action.type).toBe('attack');
  });

  test('with a prompt open it only answers', () => {
    const s = engine.createGame({ decks: [megaGengarDeck, megaDiancieDeck], seed: 2 });
    const p = s.prompt!.player;
    const { action } = bot(engine.viewFor(s, p), engine.getLegalActions(s, p), 3);
    expect(action.type).toBe('answer');
  });

  test('uses an "as often as you like" Ability at most once a turn', () => {
    const s = turn2();
    const me = s.current;
    const ref = { player: me, zone: 'active' } as const;
    const use: Action = { type: 'useAbility', slot: ref, ability: 'Solar Transfer' };
    const legal: Action[] = [use, { type: 'endTurn' }];
    expect(bot(engine.viewFor(s, me), legal, 1).action).toEqual(use);
    s.players[me].active!.abilityUses = { 'Solar Transfer': { turn: s.turn, count: 1 } };
    expect(bot(engine.viewFor(s, me), legal, 1).action).toEqual({ type: 'endTurn' });
  });

  test('never concedes', () => {
    const s = turn2();
    const legal: Action[] = [{ type: 'concede' }, { type: 'endTurn' }];
    expect(bot(engine.viewFor(s, s.current), legal, 1).action).toEqual({ type: 'endTurn' });
  });
});
