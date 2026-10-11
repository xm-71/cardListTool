import { checkKnockouts } from './combat.ts';
import type { EffectCtx } from './effects.ts';
import { log, other, slotDef } from './state.ts';
import type { PlayerId, PokemonSlot } from './types.ts';

export type Condition = 'asleep' | 'confused' | 'paralyzed' | 'poisoned' | 'burned';

/** Asleep, Confused and Paralyzed replace each other; Poisoned and Burned are independent. */
export function applyCondition(slot: PokemonSlot, c: Condition): void {
  if (c === 'poisoned') slot.conditions.poisoned = true;
  else if (c === 'burned') slot.conditions.burned = true;
  else slot.conditions.rotation = c;
}

/** Runs between turns, after `ctx.state.current` has finished their turn. */
export function pokemonCheckup(ctx: EffectCtx): void {
  const s = ctx.state;
  const ended = s.current;
  for (const player of [ended, other(ended)] as PlayerId[]) {
    const slot = s.players[player].active;
    if (!slot) continue;
    const name = slotDef(ctx.env, s, slot).name;
    if (slot.conditions.poisoned) {
      slot.damage += 10;
      log(s, 'checkup', `${name} takes 10 Poison damage`, {
        player,
        anim: { kind: 'checkup', target: slot.stack[0]!, condition: 'poisoned', amount: 10 },
      });
    }
    if (slot.conditions.burned) {
      slot.damage += 20;
      log(s, 'checkup', `${name} takes 20 Burn damage`, {
        player,
        anim: { kind: 'checkup', target: slot.stack[0]!, condition: 'burned', amount: 20 },
      });
      if (ctx.flipCoin()) slot.conditions.burned = false;
    }
    if (slot.conditions.rotation === 'asleep' && ctx.flipCoin()) {
      slot.conditions.rotation = 'none';
      log(s, 'checkup', `${name} wakes up`, {
        player,
        anim: { kind: 'checkup', target: slot.stack[0]!, condition: 'asleep' },
      });
    }
    if (slot.conditions.rotation === 'paralyzed' && player === ended) {
      slot.conditions.rotation = 'none';
      log(s, 'checkup', `${name} is no longer Paralyzed`, {
        player,
        anim: { kind: 'checkup', target: slot.stack[0]!, condition: 'paralyzed' },
      });
    }
  }
  checkKnockouts(ctx);
}

/** Confusion check before an attack. Returns false (attack fails) on tails. */
export function resolveConfusion(ctx: EffectCtx): boolean {
  const slot = ctx.state.players[ctx.me].active;
  if (!slot || slot.conditions.rotation !== 'confused') return true;
  if (ctx.flipCoin()) return true;
  slot.damage += 30;
  log(ctx.state, 'confused', `${slotDef(ctx.env, ctx.state, slot).name} hurts itself in its confusion`, {
    player: ctx.me,
  });
  return false;
}
