import { runEffect, type EffectFn } from './effects.ts';
import type { Env } from './env.ts';
import { IllegalActionError } from './errors.ts';
import { setupEffect } from './setup.ts';
import type { Action, GameEvent, GameState, Origin, PlayerId } from './types.ts';

function handlerFor(origin: Origin): EffectFn {
  switch (origin.type) {
    case 'setup':
      return setupEffect;
    default:
      throw new IllegalActionError(`Unsupported action ${origin.type}`);
  }
}

export function getLegalActions(_env: Env, state: GameState, player: PlayerId): Action[] {
  if (state.result) return [];
  const prompt = state.prompt;
  if (prompt) {
    if (prompt.player !== player) return [];
    const answers: Action[] = prompt.options.map((o) => ({ type: 'answer', optionId: o.id }));
    if (prompt.selected.length >= prompt.min) answers.push({ type: 'answer', optionId: 'done' });
    return answers;
  }
  return [];
}

export function applyAction(
  env: Env,
  state: GameState,
  player: PlayerId,
  action: Action,
): { state: GameState; events: GameEvent[] } {
  const legal = getLegalActions(env, state, player);
  const key = JSON.stringify(action);
  if (!legal.some((a) => JSON.stringify(a) === key)) {
    throw new IllegalActionError(`Illegal action for player ${player + 1}: ${key}`);
  }
  let next: GameState;
  if (action.type === 'answer') {
    const pending = state.pending;
    if (!pending) throw new IllegalActionError('Nothing to answer');
    next = runEffect(env, pending.snapshot, pending.origin, pending.player, handlerFor(pending.origin), [
      ...pending.answers,
      action.optionId,
    ]);
  } else {
    next = runEffect(env, state, action, player, handlerFor(action));
  }
  const before = state.pending ? state.pending.snapshot.log.length : state.log.length;
  return { state: next, events: next.log.slice(before) };
}
