import { applyAction, getLegalActions } from './actions.ts';
import type { CardRegistry } from './cards.ts';
import type { Env } from './env.ts';
import { standard2026, type Ruleset } from './ruleset.ts';
import { createGame } from './setup.ts';
import type { Action, DeckList, GameEvent, GameState, PlayerId } from './types.ts';

export interface Engine {
  registry: CardRegistry;
  ruleset: Ruleset;
  createGame(config: { decks: [DeckList, DeckList]; seed: number }): GameState;
  getLegalActions(state: GameState, player: PlayerId): Action[];
  applyAction(state: GameState, player: PlayerId, action: Action): { state: GameState; events: GameEvent[] };
}

export function createEngine(registry: CardRegistry, ruleset: Ruleset = standard2026): Engine {
  const env: Env = { registry, ruleset };
  return {
    registry,
    ruleset,
    createGame: (config) => createGame(env, config),
    getLegalActions: (state, player) => getLegalActions(env, state, player),
    applyAction: (state, player, action) => applyAction(env, state, player, action),
  };
}
