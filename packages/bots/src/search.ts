import { nextRandom, type Action, type Engine, type GameState, type PlayerId } from '@ptcg/engine';
import type { Bot } from './types.ts';

/** Message of the engine's promotion prompt after a Knockout. */
export const PROMOTE = 'Choose a new Active Pokémon';

/** Play the rest of `me`'s turn (and any prompts it causes) with the Easy policy. */
export function rolloutTurn(
  engine: Engine,
  easy: Bot,
  start: GameState,
  me: PlayerId,
  rngIn: number,
  steps = 30,
): { state: GameState; rng: number } {
  let s = start;
  let rng = rngIn;
  for (let i = 0; i < steps && !s.result; i++) {
    const actor = s.prompt ? s.prompt.player : s.current;
    if (actor !== me && !s.prompt) break; // the turn has passed
    const legal = engine.getLegalActions(s, actor).filter((a) => a.type !== 'concede');
    if (legal.length === 0) break;
    const r = easy(engine.viewFor(s, actor), legal, rng);
    rng = r.rng;
    s = engine.applyAction(s, actor, r.action).state;
  }
  return { state: s, rng };
}

/** The highest total wins; ties are broken by the RNG. */
export function pickBest(totals: Map<Action, number>, rngIn: number): { action: Action; rng: number } {
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
export function dedupe(
  actions: Action[],
  view: { you: { hand: { uid: string; defId: string }[] } },
): Action[] {
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
