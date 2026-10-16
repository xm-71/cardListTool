import {
  createEngine,
  nextRandom,
  type Action,
  type CardRegistry,
  type DeckList,
  type GameState,
  type PlayerId,
  type PlayerView,
} from '@ptcg/engine';
import { determinize } from './determinize.ts';
import { DamageCache } from './damage.ts';
import { createEasyBot } from './easy.ts';
import { evaluate, type EvalContext } from './evaluate.ts';
import { deckPlan } from './plan.ts';
import { createSmartBot } from './smart.ts';
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
  /**
   * Behave exactly as before the smart policy: Easy plays out the look-ahead and answers prompts, and the board is
   * scored the old way. For strength comparisons only.
   */
  legacy?: boolean;
  /** Called after each finished round with its 1-based number (tests and timing only). */
  onRound?: (round: number) => void;
  /** Called for every move scored in every guessed world (tests only); impossible moves score -1e9. */
  onScore?: (action: Action, score: number) => void;
}

/**
 * Hard bot: like Medium, but after finishing its own turn it also plays out the opponent's whole next turn
 * (with the smart policy) before scoring, so it sees replies that punish a move. It keeps trying fresh guesses of
 * the hidden cards, scoring every move once per round, until the clock budget is spent.
 * Other prompts are answered by the smart policy, as in Medium.
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
  const damage = new DamageCache();
  const policy: Bot = options.legacy ? createEasyBot(registry) : createSmartBot(registry, decks, damage);
  const ctx: EvalContext | undefined = options.legacy
    ? undefined
    : { engine, damage, plans: [deckPlan(decks[0], registry), deckPlan(decks[1], registry)] };

  /** Finish `me`'s turn, then the opponent's reply, and score the board from `me`'s side. */
  const scoreAfter = (start: GameState, me: PlayerId, rngIn: number): { score: number; rng: number } => {
    const opp: PlayerId = me === 0 ? 1 : 0;
    let { state, rng } = rolloutTurn(engine, policy, start, me, rngIn);
    if (!state.result && state.current === opp) {
      ({ state, rng } = rolloutTurn(engine, policy, state, opp, rng, REPLY_STEPS));
    }
    return { score: evaluate(state, me, registry, ctx), rng };
  };

  /** Rounds of fresh guesses; `scoreOf` values one candidate in one guessed world (throwing if it can't be played). */
  const search = (
    view: PlayerView,
    candidates: Action[],
    rngIn: number,
    scoreOf: (world: GameState, action: Action, rng: number) => number,
  ): { action: Action; rng: number } => {
    let rng = rngIn;
    const totals = new Map<Action, number>();
    let scored = 0;
    const startedAt = now();
    for (let round = 1; ; round++) {
      const d = determinize(view, decks, registry, rng);
      // Every move in a round is played out from the same random stream, so two moves are compared on the
      // same dice rolls instead of on noise from the rollouts.
      for (const action of candidates) {
        let score: number;
        try {
          score = scoreOf(d.state, action, d.rng);
          scored++;
        } catch {
          score = IMPOSSIBLE;
        }
        options.onScore?.(action, score);
        totals.set(action, (totals.get(action) ?? 0) + score);
      }
      rng = nextRandom(d.rng)[1];
      options.onRound?.(round);
      if (round >= maxRounds) break;
      if (round >= minRounds && now() - startedAt >= budgetMs) break;
    }
    // Nothing could be played in any guessed world: a random pick would be worse than the Easy policy.
    if (scored === 0) throw new Error('no candidate could be scored');
    return pickBest(totals, rng);
  };

  /** Promote the chosen Benched Pokémon by hand and score the board (the guessed world has no prompt to answer). */
  const promotionScore =
    (view: PlayerView, me: PlayerId) =>
    (world: GameState, action: Action): number => {
      if (action.type !== 'answer') throw new Error('not a promotion answer');
      const ref = view.prompt!.options.find((o) => o.id === action.optionId)?.slot;
      if (!ref || ref.zone !== 'bench') throw new Error('not a Benched Pokémon');
      const s = structuredClone(world);
      const p = s.players[me];
      p.active = p.bench.splice(ref.index, 1)[0]!;
      // Their Knock Out ended their turn: my move comes next (the scoring uses who moves next).
      if (s.current !== me) s.current = me;
      return evaluate(s, me, registry, ctx);
    };

  return (view, legal, rng) => {
    const me = view.me ?? seat;
    const candidates = dedupe(
      legal.filter((a) => a.type !== 'concede'),
      view,
    );
    if (view.prompt || candidates.length <= 1) {
      const promoting = view.prompt?.kind === 'slot' && view.prompt.message === PROMOTE;
      if (!(promoting && candidates.length > 1)) return policy(view, legal, rng);
    }
    try {
      const promoting = view.prompt?.kind === 'slot' && view.prompt.message === PROMOTE;
      return search(
        view,
        candidates,
        rng,
        promoting
          ? promotionScore(view, me)
          : (world, action, r) => scoreAfter(engine.applyAction(world, me, action).state, me, r).score,
      );
    } catch {
      return policy(view, legal, rng);
    }
  };
}
