import { checkInvariants, type DeckList, type Engine, type GameState } from '@ptcg/engine';
import type { Bot } from './types.ts';

export interface MatchResult {
  result: GameState['result'];
  turns: number;
  actions: number;
  final: GameState;
  violations: string[];
}

/** Play a full game between two bots, checking structural invariants after every action. */
export function runMatch(o: {
  engine: Engine;
  decks: [DeckList, DeckList];
  seed: number;
  bots: [Bot, Bot];
  maxActions?: number;
}): MatchResult {
  const { engine } = o;
  const max = o.maxActions ?? 3000;
  let s = engine.createGame({ decks: o.decks, seed: o.seed });
  let rng = (o.seed ^ 0x9e3779b9) >>> 0;
  let actions = 0;
  const violations: string[] = [];
  while (!s.result && actions < max) {
    const player = s.prompt ? s.prompt.player : s.current;
    const legal = engine.getLegalActions(s, player);
    if (legal.length === 0) {
      violations.push(`no legal actions for player ${player + 1} at turn ${s.turn}`);
      break;
    }
    const choice = o.bots[player](engine.viewFor(s, player), legal, rng);
    rng = choice.rng;
    s = engine.applyAction(s, player, choice.action).state;
    actions++;
    const v = checkInvariants(s, engine.registry, engine.ruleset.deckSize, engine.ruleset.benchSize);
    if (v.length) {
      violations.push(...v.map((x) => `action ${actions} (${choice.action.type}): ${x}`));
      break;
    }
  }
  return { result: s.result, turns: s.turn, actions, final: s, violations };
}
