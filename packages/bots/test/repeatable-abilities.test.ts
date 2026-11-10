import { describe, expect, test } from 'vitest';
import { createEngine, type GameState } from '@ptcg/engine';
import { finishSetup, giveCard, swapActiveTo } from '@ptcg/engine/testing';
import * as cards from '@ptcg/cards';
import { createSmartBot } from '../src/smart.ts';

const registry = cards.buildRegistry();
const engine = createEngine(registry);
const lorelei = cards.GYM_DECKS.lorelei!;
const agatha = cards.GYM_DECKS.agatha!;
const bot = createSmartBot(registry, [lorelei, agatha]);

const BAXCALIBUR = 'sv02-060';
const WATER = 'mee-003';

/** Lorelei's turn: Baxcalibur Active, `water` Basic {W} Energy in hand and nothing else useful there. */
function turn(water: number): GameState {
  for (let seed = 3; ; seed++) {
    let s = finishSetup(engine, engine.createGame({ decks: [lorelei, agatha], seed }));
    if (s.first !== 0) continue;
    for (let i = 0; i < 2; i++) s = engine.applyAction(s, s.current, { type: 'endTurn' }).state;
    swapActiveTo(s, 0, BAXCALIBUR);
    const p = s.players[0];
    p.deck.push(...p.hand.splice(0));
    for (let i = 0; i < water; i++) giveCard(s, 0, WATER);
    return s;
  }
}

describe('repeatable Energy Abilities', () => {
  test('Super Cold is used again and again until the hand has no Basic {W} Energy left', () => {
    let s = turn(4);
    const uses: string[] = [];
    for (let guard = 0; guard < 12; guard++) {
      const legal = engine.getLegalActions(s, 0);
      const action = bot(engine.viewFor(s, 0), legal, 5).action;
      if (action.type !== 'useAbility') {
        if (action.type === 'answer') {
          s = engine.applyAction(s, s.prompt!.player, action).state;
          continue;
        }
        break;
      }
      uses.push(action.ability);
      s = engine.applyAction(s, 0, action).state;
      while (s.prompt) {
        const a = bot(engine.viewFor(s, s.prompt.player), engine.getLegalActions(s, s.prompt.player), 5).action;
        s = engine.applyAction(s, s.prompt.player, a).state;
      }
    }
    expect(uses.filter((u) => u === 'Super Cold')).toHaveLength(4);
    const attached = [s.players[0].active!, ...s.players[0].bench].flatMap((x) => x.energy);
    expect(attached).toHaveLength(4);
  });
});
