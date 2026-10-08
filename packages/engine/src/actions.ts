import { attack, canUseAttack, checkKnockouts } from './combat.ts';
import { EffectCtx, runEffect, type EffectFn } from './effects.ts';
import { getRetreatCost } from './energy.ts';
import type { Env } from './env.ts';
import { IllegalActionError } from './errors.ts';
import { setupEffect } from './setup.ts';
import { playTrainer, trainerActions, useStadium } from './trainers.ts';
import {
  activeMarkers,
  clearActiveEffects,
  defOf,
  getSlot,
  isFirstTurnOf,
  log,
  slotDef,
  slotRefs,
} from './state.ts';
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
    case 'playTrainer':
      return (ctx) => playTrainer(ctx, origin.uid, origin.target);
    case 'useStadium':
      return useStadium;
    case 'useAbility':
      return (ctx) => useAbility(ctx, origin.slot, origin.ability);
    case 'endTurn':
      return endTurn;
    case 'concede':
      return (ctx) => setResult(ctx.state, ctx.opp, 'concede');
    default:
      throw new IllegalActionError(`Unsupported action ${origin.type}`);
  }
}

function playBasic(ctx: EffectCtx, uid: string): void {
  log(ctx.state, 'playBasic', `Player ${ctx.me + 1} plays ${ctx.def(uid).name}`, { player: ctx.me });
  ctx.putOnBench(ctx.me, uid);
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
  ctx.evolve(target, uid);
  const hook = ctx.env.registry.scripts[ctx.state.cards[uid]!.defId]?.onEvolveFromHand;
  if (!hook) return;
  const name = ctx.def(uid).name;
  const choice = ctx.chooseOption({
    player: ctx.me,
    options: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ],
    message: `Use ${name}'s Ability?`,
  });
  if (choice === 'yes') {
    ctx.source = { kind: 'evolve', slot: target };
    hook.use(ctx, target);
  }
}

function useAbility(ctx: EffectCtx, ref: SlotRef, ability: string): void {
  const slot = getSlot(ctx.state, ref)!;
  const def = slotDef(ctx.env, ctx.state, slot);
  slot.abilityUsedTurn[ability] = ctx.state.turn;
  const uses = slot.abilityUses?.[ability];
  slot.abilityUses = {
    ...slot.abilityUses,
    [ability]: { turn: ctx.state.turn, count: uses?.turn === ctx.state.turn ? uses.count + 1 : 1 },
  };
  ctx.source = { kind: 'ability', slot: ref, ability };
  log(ctx.state, 'ability', `${def.name} uses ${ability}`, { player: ctx.me });
  ctx.env.registry.scripts[def.id]!.abilities![ability]!.use(ctx);
}

/** How many times a repeatable ("as often as you like") Ability may be used per turn per Pokémon. */
export const REPEATABLE_CAP = 10;

/** Activated Abilities: once per turn per Pokémon, or up to REPEATABLE_CAP times if repeatable. */
function abilityActions(env: Env, state: GameState, player: PlayerId): Action[] {
  const out: Action[] = [];
  for (const ref of slotRefs(state, player)) {
    const slot = getSlot(state, ref)!;
    const def = slotDef(env, state, slot);
    const abilities = env.registry.scripts[def.id]?.abilities ?? {};
    for (const [ability, script] of Object.entries(abilities)) {
      if (script.repeatable) {
        if (
          (slot.abilityUses?.[ability]?.turn === state.turn ? slot.abilityUses[ability]!.count : 0) >=
          REPEATABLE_CAP
        )
          continue;
      } else if (slot.abilityUsedTurn[ability] === state.turn) continue;
      const ctx = new EffectCtx(state, env, player, []);
      ctx.source = { kind: 'ability', slot: ref, ability };
      if (script.canUse(ctx)) out.push({ type: 'useAbility', slot: ref, ability });
    }
  }
  return out;
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
  clearActiveEffects(active);
  p.bench[benchIndex] = active;
  p.active = incoming;
  incoming.becameActiveTurn = s.turn;
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
  out.push(...trainerActions(env, state, player));
  out.push(...abilityActions(env, state, player));
  const active = p.active;
  if (active && p.retreatTurn !== turn && p.bench.length > 0) {
    const blocked =
      active.conditions.rotation === 'asleep' ||
      active.conditions.rotation === 'paralyzed' ||
      activeMarkers(state, active).some((m) => m.kind === 'cantRetreat');
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
  const concede: Action = { type: 'concede' };
  const prompt = state.prompt;
  if (prompt) {
    if (prompt.player !== player) return [concede];
    const answers: Action[] = prompt.options.map((o) => ({ type: 'answer', optionId: o.id }));
    if (prompt.selected.length >= prompt.min) answers.push({ type: 'answer', optionId: 'done' });
    return [...answers, concede];
  }
  if (state.phase !== 'main' || player !== state.current) return [concede];
  return mainPhaseActions(env, state, player);
}

/** JSON with object keys sorted, so equivalent actions compare equal whatever their key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}

export function applyAction(
  env: Env,
  state: GameState,
  player: PlayerId,
  action: Action,
): { state: GameState; events: GameEvent[] } {
  const legal = getLegalActions(env, state, player);
  const key = canonical(action);
  if (!legal.some((a) => canonical(a) === key)) {
    throw new IllegalActionError(`Illegal action for player ${player + 1}: ${JSON.stringify(action)}`);
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
  // A paused state already shows (and returned) its partial log; replay reproduces it as a prefix.
  const before = state.log.length;
  return { state: next, events: next.log.slice(before) };
}
