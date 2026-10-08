import { create } from 'zustand';
import { IllegalActionError, type Action, type DeckList, type GameState, type PlayerId } from '@ptcg/engine';
import { usePreview } from '../ui/preview.ts';
import { engine } from './catalog.ts';

export interface GameConfig {
  mode: 'bot' | 'hotseat';
  /** Bot strength (bot mode only). */
  difficulty?: 'easy' | 'medium';
  /** Seat 0's deck. In bot mode seat 0 is the human. */
  humanDeck: DeckList;
  /** Seat 1's deck (the bot, or Player 2 in hotseat). */
  botDeck: DeckList;
  seed: number;
}

export interface RecordedAction {
  player: PlayerId;
  action: Action;
}

interface GameStore {
  state: GameState | null;
  config: GameConfig | null;
  /** Seat the human plays in bot mode. */
  human: PlayerId;
  actions: RecordedAction[];
  error: string | null;
  start(cfg: GameConfig): void;
  dispatch(player: PlayerId, action: Action): void;
  reset(): void;
}

export const useGame = create<GameStore>()((set, get) => ({
  state: null,
  config: null,
  human: 0,
  actions: [],
  error: null,
  start(cfg) {
    const state = engine.createGame({
      decks: [cfg.humanDeck, cfg.botDeck],
      seed: cfg.seed,
    });
    usePreview.getState().show(null);
    set({ state, config: cfg, human: 0, actions: [], error: null });
  },
  dispatch(player, action) {
    const { state, actions } = get();
    if (!state) return;
    try {
      const next = engine.applyAction(state, player, action).state;
      set({ state: next, actions: [...actions, { player, action }] });
    } catch (e) {
      // Stale clicks (double clicks, clicks during a bot move) are simply ignored.
      if (e instanceof IllegalActionError) return;
      set({ error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
    }
  },
  reset() {
    usePreview.getState().show(null);
    set({ state: null, config: null, human: 0, actions: [], error: null });
  },
}));

/** Who must act now: the prompted player, else the player whose turn it is; null when the game is over. */
export function actorOf(state: GameState): PlayerId | null {
  if (state.result) return null;
  return state.prompt ? state.prompt.player : state.current;
}
