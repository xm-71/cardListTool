import type { TrainerDef } from './cards.ts';
import { EffectCtx } from './effects.ts';
import type { Env } from './env.ts';
import { defOf, isFirstTurnOf, log, slotDef, slotRefs, getSlot } from './state.ts';
import type { Action, GameState, PlayerId, SlotRef } from './types.ts';
import { removeFrom } from './zones.ts';

/** A ctx for read-only checks (canPlay / canUse). Never mutate through it. */
export function probe(env: Env, state: GameState, player: PlayerId): EffectCtx {
  return new EffectCtx(state, env, player, []);
}

export function trainerActions(env: Env, state: GameState, player: PlayerId): Action[] {
  const p = state.players[player];
  const out: Action[] = [];
  const stadiumName = state.stadium ? defOf(env, state, state.stadium.uid).name : null;
  for (const uid of p.hand) {
    const def = defOf(env, state, uid);
    if (def.category !== 'Trainer') continue;
    const script = env.registry.scripts[def.id]?.trainer;
    const ctx = probe(env, state, player);
    ctx.source = { kind: 'trainer', uid };
    switch (def.trainerType) {
      case 'Supporter':
        if (p.supporterTurn === state.turn) continue;
        if (
          player === state.first &&
          isFirstTurnOf(state, player) &&
          !env.ruleset.firstPlayerCanPlaySupporterTurn1
        )
          continue;
        if (script?.canPlay && !script.canPlay(ctx)) continue;
        out.push({ type: 'playTrainer', uid });
        break;
      case 'Item':
        if (script?.canPlay && !script.canPlay(ctx)) continue;
        out.push({ type: 'playTrainer', uid });
        break;
      case 'Stadium':
        if (stadiumName === def.name) continue;
        out.push({ type: 'playTrainer', uid });
        break;
      case 'Tool':
        for (const target of slotRefs(state, player)) {
          if (getSlot(state, target)!.tool === null) out.push({ type: 'playTrainer', uid, target });
        }
        break;
    }
  }
  const stadium = state.stadium && env.registry.scripts[state.cards[state.stadium.uid]!.defId]?.stadium;
  if (
    stadium?.use &&
    p.stadiumUsedTurn !== state.turn &&
    (!stadium.canUse || stadium.canUse(probe(env, state, player)))
  ) {
    out.push({ type: 'useStadium' });
  }
  return out;
}

export function playTrainer(ctx: EffectCtx, uid: string, target?: SlotRef): void {
  const s = ctx.state;
  const p = s.players[ctx.me];
  const def = ctx.def(uid) as TrainerDef;
  removeFrom(p.hand, uid);
  ctx.source = target ? { kind: 'trainer', uid, target } : { kind: 'trainer', uid };
  log(s, 'playTrainer', `Player ${ctx.me + 1} plays ${def.name}`, { player: ctx.me });
  switch (def.trainerType) {
    case 'Tool': {
      const slot = getSlot(s, target!)!;
      slot.tool = uid;
      log(s, 'tool', `${def.name} is attached to ${slotDef(ctx.env, s, slot).name}`, { player: ctx.me });
      return;
    }
    case 'Stadium': {
      if (s.stadium) s.players[s.stadium.owner].discard.push(s.stadium.uid);
      s.stadium = { uid, owner: ctx.me };
      return;
    }
    case 'Supporter':
      p.supporterTurn = s.turn;
      break;
    case 'Item':
      break;
  }
  // The card sits in the discard pile while it resolves, so a paused effect is still a valid state.
  p.discard.push(uid);
  ctx.env.registry.scripts[def.id]?.trainer?.play(ctx);
}

export function useStadium(ctx: EffectCtx): void {
  const s = ctx.state;
  const stadium = s.stadium!;
  s.players[ctx.me].stadiumUsedTurn = s.turn;
  ctx.source = { kind: 'stadium' };
  log(s, 'useStadium', `Player ${ctx.me + 1} uses ${ctx.def(stadium.uid).name}`, { player: ctx.me });
  ctx.env.registry.scripts[s.cards[stadium.uid]!.defId]?.stadium?.use?.(ctx);
}
