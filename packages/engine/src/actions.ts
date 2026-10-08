import { attack, canUseAttack, checkKnockouts } from './combat.ts';
import { EffectCtx, runEffect, type EffectFn } from './effects.ts';
import { getRetreatCost } from './energy.ts';
import type { Env } from './env.ts';
import { IllegalActionError } from './errors.ts';
import { setupEffect } from './setup.ts';
import { defOf, getSlot, isFirstTurnOf, log, newSlot, slotDef, slotRefs } from './state.ts';
import { endTurn, setResult } from './turn.ts';
import type { Action, GameEvent, GameState, Origin, PlayerId, SlotRef } from './types.ts';
import { removeFrom } from './zones.ts';

/** Every action ends with a Knockout check (e.g. damage counters placed by abilities). */
function handlerFor(origin: Origin): EffectFn {
  const fn = baseHandler(origin);
  return (ctx) => {
    fn(ctx);
    checkKnockouts(ctx);
  };
}

function baseHandler(origin: Origin): EffectFn {
  switch (origin.type) {
    case 'setup':
      return setupEffect;
    case 'playBasic':
      return (ctx) => playBasic(ctx, origin.uid);
    case 'attachEnergy':
      return (ctx) => attachEnergy(ctx, origin.uid, origin.target);
    case 'evolve':
      return (ctx) => evolve(ctx, origin.uid, origin.target);
    case 'retreat':
      return (ctx) => retreat(ctx, origin.benchIndex);
    case 'attack':
      return (ctx) => attack(ctx, origin.attackIndex);
    case 'endTurn':
      return endTurn;
    case 'concede':
      return (ctx) => setResult(ctx.state, ctx.opp, 'concede');
    default:
      throw new IllegalActionError(`Unsupported action ${origin.type}`);
  }
}

function playBasic(ctx: EffectCtx, uid: string): void {
  const p = ctx.state.players[ctx.me];
  removeFrom(p.hand, uid);
  p.bench.push(newSlot(uid, ctx.state.turn));
  log(ctx.state, 'playBasic', `Player ${ctx.me + 1} puts ${ctx.def(uid).name} on the Bench`, {
    player: ctx.me,
  });
}

function attachEnergy(ctx: EffectCtx, uid: string, target: SlotRef): void {
  const p = ctx.state.players[ctx.me];
  removeFrom(p.hand, uid);
  getSlot(ctx.state, target)!.energy.push(uid);
  p.energyTurn = ctx.state.turn;
  const onto = slotDef(ctx.env, ctx.state, getSlot(ctx.state, target)!).name;
  log(ctx.state, 'attachEnergy', `Player ${ctx.me + 1} attaches ${ctx.def(uid).name} to ${onto}`, {
    player: ctx.me,
  });
}

function evolve(ctx: EffectCtx, uid: string, target: SlotRef): void {
  const p = ctx.state.players[ctx.me];
  const slot = getSlot(ctx.state, target)!;
  const from = slotDef(ctx.env, ctx.state, slot).name;
  removeFrom(p.hand, uid);
  slot.stack.push(uid);
  slot.evolvedTurn = ctx.state.turn;
  slot.conditions = { rotation: 'none', poisoned: false, burned: false };
  log(ctx.state, 'evolve', `Player ${ctx.me + 1} evolves ${from} into ${ctx.def(uid).name}`, {
    player: ctx.me,
  });
}

function retreat(ctx: EffectCtx, benchIndex: number): void {
  const s = ctx.state;
  const p = s.players[ctx.me];
  const active = p.active!;
  const cost = getRetreatCost(s, { player: ctx.me, zone: 'active' }, ctx.env.registry);
  const discard = ctx.chooseCards({
    player: ctx.me,
    from: active.energy,
    min: cost,
    max: cost,
    message: `Choose ${cost} Energy to discard to retreat`,
  });
  for (const uid of discard) {
    removeFrom(active.energy, uid);
    p.discard.push(uid);
  }
  const incoming = p.bench[benchIndex]!;
  active.conditions = { rotation: 'none', poisoned: false, burned: false };
  p.bench[benchIndex] = active;
  p.active = incoming;
  p.retreatTurn = s.turn;
  log(s, 'retreat', `Player ${ctx.me + 1} retreats to ${slotDef(ctx.env, s, incoming).name}`, {
    player: ctx.me,
  });
}

function mainPhaseActions(env: Env, state: GameState, player: PlayerId): Action[] {
  const p = state.players[player];
  const out: Action[] = [];
  const turn = state.turn;
  const mySlots = slotRefs(state, player);
  for (const uid of p.hand) {
    const def = defOf(env, state, uid);
    if (def.category === 'Pokemon') {
      if (def.stage === 'Basic') {
        if (p.bench.length < env.ruleset.benchSize) out.push({ type: 'playBasic', uid });
      } else if (!isFirstTurnOf(state, player)) {
        for (const target of mySlots) {
          const slot = getSlot(state, target)!;
          if (slot.enteredTurn >= turn || slot.evolvedTurn === turn) continue;
          if (slotDef(env, state, slot).name === def.evolvesFrom) out.push({ type: 'evolve', uid, target });
        }
      }
    } else if (def.category === 'Energy' && p.energyTurn !== turn) {
      for (const target of mySlots) out.push({ type: 'attachEnergy', uid, target });
    }
  }
  const active = p.active;
  if (active && p.retreatTurn !== turn && p.bench.length > 0) {
    const blocked = active.conditions.rotation === 'asleep' || active.conditions.rotation === 'paralyzed';
    const cost = getRetreatCost(state, { player, zone: 'active' }, env.registry);
    if (!blocked && active.energy.length >= cost) {
      p.bench.forEach((_, benchIndex) => out.push({ type: 'retreat', benchIndex }));
    }
  }
  if (active) {
    const probe = new EffectCtx(state, env, player, []);
    slotDef(env, state, active).attacks.forEach((_, attackIndex) => {
      if (canUseAttack(env, state, player, attackIndex, probe)) out.push({ type: 'attack', attackIndex });
    });
  }
  out.push({ type: 'endTurn' }, { type: 'concede' });
  return out;
}

export function getLegalActions(env: Env, state: GameState, player: PlayerId): Action[] {
  if (state.result) return [];
  const prompt = state.prompt;
  if (prompt) {
    if (prompt.player !== player) return [];
    const answers: Action[] = prompt.options.map((o) => ({ type: 'answer', optionId: o.id }));
    if (prompt.selected.length >= prompt.min) answers.push({ type: 'answer', optionId: 'done' });
    return answers;
  }
  if (state.phase !== 'main' || player !== state.current) return [];
  return mainPhaseActions(env, state, player);
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
