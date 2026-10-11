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


/**
 * Medium bot: for each candidate move, plays it on several guessed versions of the hidden
 * cards, finishes the turn with the Easy policy, scores the result and picks the best average.
 * Promotions are scored the same way; other prompts are answered by the Easy policy
 * (a paused effect can't be rebuilt from a view).
 */
export function createMediumBot(
  registry: CardRegistry,
  decks: [DeckList, DeckList],
  seat: PlayerId,
  samples = 4,
): Bot {
  const engine = createEngine(registry);
  const easy = createEasyBot(registry);

  const rollout = (start: GameState, me: PlayerId, rng: number) => rolloutTurn(engine, easy, start, me, rng);

  /** Score each Benched Pokémon by promoting it on guessed states and evaluating the result. */
  const choosePromotion = (view: PlayerView, candidates: Action[], rngIn: number) => {
    let rng = rngIn;
    const me = view.me;
    const totals = new Map<Action, number>();
    for (let k = 0; k < samples; k++) {
      const d = determinize(view, decks, registry, rng);
      rng = d.rng;
      for (const action of candidates) {
        if (action.type !== 'answer') continue;
        const ref = view.prompt!.options.find((o) => o.id === action.optionId)?.slot;
        if (!ref || ref.zone !== 'bench') continue;
        const s = structuredClone(d.state);
        const p = s.players[me];
        p.active = p.bench.splice(ref.index, 1)[0]!;
        totals.set(action, (totals.get(action) ?? 0) + evaluate(s, me, registry));
      }
    }
    return pickBest(totals, rng);
  };

  return (view, legal, rngIn) => {
    let rng = rngIn;
    const me = view.me ?? seat;
    const candidates = dedupe(
      legal.filter((a) => a.type !== 'concede'),
      view,
    );
    if (view.prompt?.kind === 'slot' && view.prompt.message === PROMOTE && candidates.length > 1) {
      try {
        return choosePromotion(view, candidates, rng);
      } catch {
        return easy(view, legal, rng);
      }
    }
    if (view.prompt || candidates.length <= 1) return easy(view, legal, rng);
    try {
      const totals = new Map<Action, number>();
      for (let k = 0; k < samples; k++) {
        const d = determinize(view, decks, registry, rng);
        rng = d.rng;
        for (const action of candidates) {
          let score: number;
          try {
            const after = engine.applyAction(d.state, me, action).state;
            const r = rollout(after, me, rng);
            rng = r.rng;
            score = evaluate(r.state, me, registry);
          } catch {
            score = -1e9; // not legal in this guessed world (e.g. depends on hidden cards)
          }
          totals.set(action, (totals.get(action) ?? 0) + score);
        }
      }
      return pickBest(totals, rng);
    } catch {
      return easy(view, legal, rng);
    }
  };
}
