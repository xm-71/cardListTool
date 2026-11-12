import { describe, expect, test } from 'vitest';
import { createEngine, type Action, type GameState } from '@ptcg/engine';
import { attachFromDeck, finishSetup, swapActiveTo } from '@ptcg/engine/testing';
import * as cards from '@ptcg/cards';
import { createSmartBot } from '../src/smart.ts';

const registry = cards.buildRegistry();
const engine = createEngine(registry);
const lance = cards.GYM_DECKS['johto-lance']!;
const agatha = cards.GYM_DECKS.agatha!;
const bot = createSmartBot(registry, [lance, agatha]);

const RAGING_BOLT = 'sv05-123';
const MUNKIDORI = 'sv06-095'; // 110 HP, weak to Darkness: no Weakness to Lightning or Fighting
const LIGHTNING = 'mee-004';
const FIGHTING = 'mee-006';

/** Johto Lance's turn with Raging Bolt ex Active holding Lightning, Fighting and `extra` more Fighting Energy. */
function setup(extra: number): GameState {
  for (let seed = 3; ; seed++) {
    let s = finishSetup(engine, engine.createGame({ decks: [lance, agatha], seed }));
    if (s.first !== 0) continue;
    for (let i = 0; i < 2; i++) s = engine.applyAction(s, s.current, { type: 'endTurn' }).state;
    swapActiveTo(s, 0, RAGING_BOLT);
    swapActiveTo(s, 1, MUNKIDORI);
    s.players[0].deck.push(...s.players[0].hand.splice(0));
    for (const id of [LIGHTNING, FIGHTING, ...Array<string>(extra).fill(FIGHTING)]) attachFromDeck(s, 0, id);
    return s;
  }
}

function bellowingThunder(s0: GameState): GameState {
  let s = engine.applyAction(s0, 0, { type: 'attack', attackIndex: 1 }).state;
  for (let guard = 0; s.prompt && guard < 30; guard++) {
    const legal = engine.getLegalActions(s, s.prompt.player);
    const action: Action = bot(engine.viewFor(s, s.prompt.player), legal, 5).action;
    s = engine.applyAction(s, s.prompt.player, action).state;
  }
  return s;
}

describe('Bellowing Thunder (discard any amount of Basic Energy, 70 damage each)', () => {
  test('the smart bot discards just enough Energy to Knock Out the Defending Pokémon', () => {
    const s = bellowingThunder(setup(3)); // 5 Energy; 110 HP needs 2 discards (140)
    expect(s.players[1].active?.stack[0]).not.toBe(setup(3).players[1].active!.stack[0]);
    expect(s.players[0].active!.energy).toHaveLength(3);
    expect(s.players[0].prizes).toHaveLength(5);
  });

  test('when no Knock Out is reachable it keeps the Energy Bellowing Thunder costs ({L}{F}), not just one card', () => {
    const s0 = setup(2); // Lightning + 3 Fighting
    s0.players[1].active!.damage = -5000; // far too much HP for any number of discards
    const s = bellowingThunder(s0);
    const left = s.players[0].active!.energy.map((u) => s.cards[u]!.defId).sort();
    expect(left).toEqual([LIGHTNING, FIGHTING].sort());
    expect(s.players[1].active!.damage).toBe(-5000 + 140);
  });
});
