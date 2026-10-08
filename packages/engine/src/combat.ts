import { resolveConfusion } from './conditions.ts';
import type { EffectCtx } from './effects.ts';
import { canPayCost } from './energy.ts';
import type { Env } from './env.ts';
import { sameSlot, scriptsInPlay } from './hooks.ts';
import { getSlot, isFirstTurnOf, log, other, slotDef, slotRefs } from './state.ts';
import { endTurn, setResult } from './turn.ts';
import type { GameState, PlayerId, SlotRef } from './types.ts';

/** Per-attack bookkeeping kept on the ctx while an attack resolves (never stored in state). */
export interface AttackInfo {
  attacker: SlotRef;
  attackerIsEx: boolean;
  damaged: SlotRef[];
}

const attackInfo = new WeakMap<EffectCtx, AttackInfo>();
export const currentAttack = (ctx: EffectCtx): AttackInfo | undefined => attackInfo.get(ctx);

export function canUseAttack(
  env: Env,
  state: GameState,
  player: PlayerId,
  attackIndex: number,
  ctx: EffectCtx,
): boolean {
  const active = state.players[player].active;
  if (!active) return false;
  if (isFirstTurnOf(state, player) && player === state.first && !env.ruleset.firstPlayerCanAttackTurn1)
    return false;
  if (active.conditions.rotation === 'asleep' || active.conditions.rotation === 'paralyzed') return false;
  if (active.cantAttackOnTurn === state.turn) return false;
  const def = slotDef(env, state, active);
  const attack = def.attacks[attackIndex];
  if (!attack || !canPayCost(attack.cost, active.energy, state, env.registry)) return false;
  const script = env.registry.scripts[def.id]?.attacks?.[attackIndex];
  if (script?.canUse) {
    ctx.source = { kind: 'attack', slot: { player, zone: 'active' }, attackIndex };
    return script.canUse(ctx);
  }
  return true;
}

/**
 * Deal attack damage from the current attacker to `target`. Damage to the opponent's
 * Active goes through modifiers and Weakness/Resistance; damage to Benched Pokémon does not.
 * Returns the damage actually dealt.
 */
export function dealAttackDamage(ctx: EffectCtx, target: SlotRef, base: number): number {
  const s = ctx.state;
  const info = currentAttack(ctx);
  if (!info) throw new Error('dealAttackDamage outside an attack');
  const targetSlot = getSlot(s, target);
  if (!targetSlot) return 0;
  let amount = base;
  if (target.zone === 'active' && target.player !== info.attacker.player) {
    const registry = ctx.env.registry;
    for (const h of scriptsInPlay(ctx.env, s, info.attacker.player)) {
      if (h.script.modifyOutgoingDamage) {
        amount = h.script.modifyOutgoingDamage({
          state: s,
          holder: h.ref,
          attacker: info.attacker,
          defender: target,
          amount,
          registry,
        });
      }
    }
    const attackerDef = slotDef(ctx.env, s, getSlot(s, info.attacker)!);
    const defenderDef = slotDef(ctx.env, s, targetSlot);
    if (amount > 0 && defenderDef.weakness && attackerDef.types.includes(defenderDef.weakness)) amount *= 2;
    if (defenderDef.resistance && attackerDef.types.includes(defenderDef.resistance)) amount -= 30;
    for (const h of scriptsInPlay(ctx.env, s, target.player)) {
      if (h.script.modifyIncomingDamage) {
        amount = h.script.modifyIncomingDamage({
          state: s,
          holder: h.ref,
          attacker: info.attacker,
          defender: target,
          amount,
          registry,
        });
      }
    }
  }
  amount = Math.max(0, amount);
  targetSlot.damage += amount;
  if (amount > 0) info.damaged.push(target);
  log(s, 'damage', `${slotDef(ctx.env, s, targetSlot).name} takes ${amount} damage`, { amount });
  return amount;
}

export function attack(ctx: EffectCtx, attackIndex: number): void {
  const s = ctx.state;
  const me = ctx.me;
  const attackerRef: SlotRef = { player: me, zone: 'active' };
  const attacker = getSlot(s, attackerRef)!;
  const def = slotDef(ctx.env, s, attacker);
  const atk = def.attacks[attackIndex]!;
  const script = ctx.env.registry.scripts[def.id]?.attacks?.[attackIndex];
  ctx.source = { kind: 'attack', slot: attackerRef, attackIndex };
  attackInfo.set(ctx, { attacker: attackerRef, attackerIsEx: def.isEx, damaged: [] });
  log(s, 'attack', `${def.name} uses ${atk.name}`, { player: me });

  if (resolveConfusion(ctx)) {
    const base = script?.damage ? script.damage(ctx) : atk.damage;
    const defenderRef: SlotRef = { player: ctx.opp, zone: 'active' };
    if (base > 0 && getSlot(s, defenderRef)) dealAttackDamage(ctx, defenderRef, base);
    script?.effect?.(ctx);
    afterDamaged(ctx);
  }
  checkKnockouts(ctx);
  // Anything after this (Pokémon Checkup) is no longer part of the attack.
  attackInfo.delete(ctx);
  endTurn(ctx);
}

/** Tools such as Punk Helmet react when the Pokémon holding them is damaged in the Active Spot. */
function afterDamaged(ctx: EffectCtx): void {
  const info = currentAttack(ctx)!;
  for (const target of info.damaged) {
    if (target.zone !== 'active' || target.player === info.attacker.player) continue;
    for (const h of scriptsInPlay(ctx.env, ctx.state, target.player)) {
      if (sameSlot(h.ref, target) && h.script.afterDamagedInActive)
        h.script.afterDamagedInActive(ctx, target, info.attacker);
    }
  }
}

/** Remove Knocked Out Pokémon, hand out Prizes, check for a winner and have players promote. */
export function checkKnockouts(ctx: EffectCtx): void {
  const s = ctx.state;
  const env = ctx.env;
  if (s.result) return;
  const knocked: SlotRef[] = [];
  for (const player of [0, 1] as PlayerId[]) {
    for (const ref of slotRefs(s, player)) {
      const slot = getSlot(s, ref)!;
      if (slot.damage >= slotDef(env, s, slot).hp) knocked.push(ref);
    }
  }
  if (knocked.length === 0) return;
  const info = currentAttack(ctx);
  // Work out Prizes before anything leaves play (abilities like Shadowy Concealment must still be in play).
  const prizeAwards = knocked.map((ref) => {
    const def = slotDef(env, s, getSlot(s, ref)!);
    let prizes = env.ruleset.prizeValue(def);
    const byAttackFromEx = !!info && info.attackerIsEx && ref.player !== info.attacker.player;
    for (const holderSide of [0, 1] as PlayerId[]) {
      for (const h of scriptsInPlay(env, s, holderSide)) {
        if (h.script.modifyPrizes) {
          prizes = h.script.modifyPrizes({
            state: s,
            holder: h.ref,
            holderSide,
            knockedOut: ref,
            byAttackFromEx,
            prizes,
            registry: env.registry,
          });
        }
      }
    }
    return { ref, taker: other(ref.player), prizes: Math.max(0, prizes), name: def.name };
  });
  // Move Knocked Out Pokémon to the discard pile; remove Bench slots from the highest index down.
  const ordered = [...knocked].sort(
    (a, b) => (b.zone === 'bench' ? b.index : -1) - (a.zone === 'bench' ? a.index : -1),
  );
  for (const ref of ordered) {
    const p = s.players[ref.player];
    const slot = getSlot(s, ref)!;
    p.discard.push(...slot.stack, ...slot.energy, ...(slot.tool ? [slot.tool] : []));
    if (ref.zone === 'active') p.active = null;
    else p.bench.splice(ref.index, 1);
  }
  for (const award of prizeAwards) {
    log(s, 'knockout', `${award.name} is Knocked Out`, { player: award.ref.player });
    const taker = s.players[award.taker];
    const taken = taker.prizes.splice(0, award.prizes);
    taker.hand.push(...taken);
    if (taken.length)
      log(s, 'prize', `Player ${award.taker + 1} takes ${taken.length} Prize card(s)`, {
        player: award.taker,
      });
  }
  const won = ([0, 1] as PlayerId[]).map((p) => {
    const opp = s.players[other(p)];
    if (s.players[p].prizes.length === 0) return 'prizes' as const;
    if (!opp.active && opp.bench.length === 0) return 'noPokemon' as const;
    return null;
  });
  if (won[0] && won[1]) return setResult(s, 'draw', won[0]);
  if (won[0]) return setResult(s, 0, won[0]);
  if (won[1]) return setResult(s, 1, won[1]);
  // The player whose turn it is not promotes first.
  for (const player of [other(s.current), s.current]) {
    const p = s.players[player];
    if (p.active || p.bench.length === 0) continue;
    const [pick] = ctx.chooseSlot({
      player,
      among: p.bench.map((_, index) => ({ player, zone: 'bench', index }) as SlotRef),
      min: 1,
      max: 1,
      message: 'Choose a new Active Pokémon',
    });
    const index = (pick as { index: number }).index;
    p.active = p.bench.splice(index, 1)[0]!;
    log(s, 'promote', `Player ${player + 1} promotes ${slotDef(env, s, p.active).name}`, { player });
  }
}
