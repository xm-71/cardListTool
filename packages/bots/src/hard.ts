import {
  createEngine,
  type Action,
  type CardRegistry,
  type DeckList,
  type GameState,
  type PlayerId,
  type PlayerView,
} from '@ptcg/engine';
import { determinize } from './determinize.ts';
import { createEasyBot } from './easy.ts';
import { evaluate } from './evaluate.ts';
import { dedupe, pickBest, PROMOTE, rolloutTurn } from './search.ts';
import type { Bot } from './types.ts';

/** Score given to a move that can't be played in a guessed world (e.g. it depends on hidden cards). */
const IMPOSSIBLE = -1e9;
/** Step cap for playing out the opponent's reply turn. */
const REPLY_STEPS = 60;

export interface HardOptions {
  /** Thinking budget per decision, by the clock. Default 1500 ms. */
  budgetMs?: number;
  /** Always run at least this many rounds of guesses, even past the budget. Default 1. */
  minRounds?: number;
  /** Never run more than this many rounds. Default 16. */
  maxRounds?: number;
  /** Clock in ms. Default `performance.now`. Tests, fuzz runs and balance runs pass a fake one. */
  now?: () => number;
  /** Called after each finished round with its 1-based number (tests and timing only). */
  onRound?: (round: number) => void;
}

/**
 * Hard bot: like Medium, but after finishing its own turn it also plays out the opponent's whole next turn
 * (with the Easy policy) before scoring, so it sees replies that punish a move. It keeps trying fresh guesses of
 * the hidden cards, scoring every move once per round, until the clock budget is spent.
 * Other prompts are answered by the Easy policy, as in Medium.
 */
export function createHardBot(
  registry: CardRegistry,
  decks: [DeckList, DeckList],
  seat: PlayerId,
  options: HardOptions = {},
): Bot {
  const budgetMs = options.budgetMs ?? 1500;
  const minRounds = options.minRounds ?? 1;
  const maxRounds = options.maxRounds ?? 16;
  const now = options.now ?? (() => performance.now());
  const engine = createEngine(registry);
  const easy = createEasyBot(registry);

  /** Finish `me`'s turn, then the opponent's reply, and score the board from `me`'s side. */
  const scoreAfter = (start: GameState, me: PlayerId, rngIn: number): { score: number; rng: number } => {
    const opp: PlayerId = me === 0 ? 1 : 0;
    let { state, rng } = rolloutTurn(engine, easy, start, me, rngIn);
    if (!state.result && state.current === opp) {
      ({ state, rng } = rolloutTurn(engine, easy, state, opp, rng, REPLY_STEPS));
    }
    return { score: evaluate(state, me, registry), rng };
  };

  /** Rounds of fresh guesses; `play` turns one candidate in one guessed world into a state to score. */
  const search = (
    view: PlayerView,
    candidates: Action[],
    rngIn: number,
    play: (world: GameState, action: Action) => GameState,
  ): { action: Action; rng: number } => {
    let rng = rngIn;
    const me = view.me ?? seat;
    const totals = new Map<Action, number>();
    const startedAt = now();
    for (let round = 1; ; round++) {
      const d = determinize(view, decks, registry, rng);
      rng = d.rng;
      for (const action of candidates) {
        let score: number;
        try {
          const r = scoreAfter(play(d.state, action), me, rng);
          rng = r.rng;
          score = r.score;
        } catch {
          score = IMPOSSIBLE;
        }
        totals.set(action, (totals.get(action) ?? 0) + score);
      }
      options.onRound?.(round);
      if (round >= maxRounds) break;
      if (round >= minRounds && now() - startedAt >= budgetMs) break;
    }
    return pickBest(totals, rng);
  };

  return (view, legal, rng) => {
    const me = view.me ?? seat;
    const candidates = dedupe(
      legal.filter((a) => a.type !== 'concede'),
      view,
    );
    if (view.prompt || candidates.length <= 1) {
      const promoting = view.prompt?.kind === 'slot' && view.prompt.message === PROMOTE;
      if (!(promoting && candidates.length > 1)) return easy(view, legal, rng);
    }
    try {
      return search(view, candidates, rng, (world, action) => engine.applyAction(world, me, action).state);
    } catch {
      return easy(view, legal, rng);
    }
  };
}
