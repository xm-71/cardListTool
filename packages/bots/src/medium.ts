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
import { createEasyBot } from './easy.ts';
import { evaluate } from './evaluate.ts';
import type { Bot } from './types.ts';

const ROLLOUT_STEPS = 30;
/** Message of the engine's promotion prompt after a Knockout. */
const PROMOTE = 'Choose a new Active Pokémon';

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

  /** Play the rest of `me`'s turn (and any prompts it causes) with the Easy policy. */
  const rollout = (start: GameState, me: PlayerId, rngIn: number): { state: GameState; rng: number } => {
    let s = start;
    let rng = rngIn;
    for (let i = 0; i < ROLLOUT_STEPS && !s.result; i++) {
      const actor = s.prompt ? s.prompt.player : s.current;
      if (actor !== me && !s.prompt) break; // the turn has passed
      const legal = engine.getLegalActions(s, actor).filter((a) => a.type !== 'concede');
      if (legal.length === 0) break;
      const r = easy(engine.viewFor(s, actor), legal, rng);
      rng = r.rng;
      s = engine.applyAction(s, actor, r.action).state;
    }
    return { state: s, rng };
  };

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

/** The highest total wins; ties are broken by the RNG. */
function pickBest(totals: Map<Action, number>, rngIn: number): { action: Action; rng: number } {
  let best: Action[] = [];
  let bestScore = -Infinity;
  for (const [action, total] of totals) {
    if (total > bestScore + 1e-9) {
      best = [action];
      bestScore = total;
    } else if (Math.abs(total - bestScore) <= 1e-9) best.push(action);
  }
  if (best.length === 0) throw new Error('no candidate could be scored');
  const [v, rng] = nextRandom(rngIn);
  return { action: best[Math.floor(v * best.length)]!, rng };
}

/** Collapse actions that differ only by which copy of the same card they use. */
function dedupe(actions: Action[], view: { you: { hand: { uid: string; defId: string }[] } }): Action[] {
  const defOf = new Map(view.you.hand.map((c) => [c.uid, c.defId]));
  const seen = new Set<string>();
  const out: Action[] = [];
  for (const a of actions) {
    const key = JSON.stringify('uid' in a ? { ...a, uid: defOf.get(a.uid) ?? a.uid } : a);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}
