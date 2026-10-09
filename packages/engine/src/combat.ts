import { resolveConfusion } from './conditions.ts';
import type { EffectCtx } from './effects.ts';
import { canPayCost } from './energy.ts';
import type { Env } from './env.ts';
import { sameSlot, scriptsInPlay } from './hooks.ts';
import { activeMarkers, getSlot, isFirstTurnOf, log, maxHp, other, slotDef, slotRefs } from './state.ts';
import { endTurn, setResult } from './turn.ts';
import type { EnergyType, GameState, MarkerKind, PlayerId, PokemonSlot, SlotRef } from './types.ts';

/** Per-attack bookkeeping kept on the ctx while an attack resolves (never stored in state). */
export interface AttackInfo {
  attacker: SlotRef;
  attackerIsEx: boolean;
  damaged: SlotRef[];
}

const attackInfo = new WeakMap<EffectCtx, AttackInfo>();
export const currentAttack = (ctx: EffectCtx): AttackInfo | undefined => attackInfo.get(ctx);

/**
 * The attack bookkeeping names board positions, so when an effect swaps a player's Active Pokémon with a
 * Benched one (Mach Turn, Push Down) the positions of the two Pokémon are swapped with them.
 */
export function followSwitch(ctx: EffectCtx, player: PlayerId, benchIndex: number): void {
  const info = attackInfo.get(ctx);
  if (!info) return;
  const move = (ref: SlotRef): SlotRef => {
    if (ref.player !== player) return ref;
    if (ref.zone === 'active') return { player, zone: 'bench', index: benchIndex };
    return ref.index === benchIndex ? { player, zone: 'active' } : ref;
  };
  info.attacker = move(info.attacker);
  info.damaged = info.damaged.map(move);
}

export function canUseAttack(
  env: Env,
  state: GameState,
  player: PlayerId,
  attackIndex: number,
  ctx: EffectCtx,
  /** The Benched Pokémon using an attack that "can be used even if this Pokémon is on the Bench". */
  benchIndex?: number,
): boolean {
  const ref: SlotRef =
    benchIndex === undefined ? { player, zone: 'active' } : { player, zone: 'bench', index: benchIndex };
  const slot = getSlot(state, ref);
  if (!slot) return false;
  if (isFirstTurnOf(state, player) && player === state.first && !env.ruleset.firstPlayerCanAttackTurn1)
    return false;
  if (
    ref.zone === 'active' &&
    (slot.conditions.rotation === 'asleep' || slot.conditions.rotation === 'paralyzed')
  )
    return false;
  if (slot.cantAttackOnTurn === state.turn) return false;
  const def = slotDef(env, state, slot);
  const attack = def.attacks[attackIndex];
  if (!attack || slot.attackLocks?.[attack.name] === state.turn) return false;
  const script = env.registry.scripts[def.id]?.attacks?.[attackIndex];
  if (ref.zone === 'bench' && !script?.fromBench) return false;
  let cost = attack.cost;
  const costHook = env.registry.scripts[def.id]?.modifyAttackCost;
  if (costHook) cost = costHook({ state, holder: ref, attackIndex, cost, registry: env.registry });
  const extra = sumMarkers(state, slot, 'attackCostMore');
  if (extra > 0) cost = [...cost, ...Array<EnergyType>(extra).fill('Colorless')];
  if (!canPayCost(cost, slot.energy, state, env.registry)) return false;
  if (script?.canUse) {
    ctx.source = { kind: 'attack', slot: ref, attackIndex };
    return script.canUse(ctx);
  }
  return true;
}

/**
 * Deal attack damage from the current attacker to `target`. Damage to the opponent's
 * Active goes through modifiers and Weakness/Resistance; damage to Benched Pokémon does not.
 * Returns the damage actually dealt.
 */
function sumMarkers(state: GameState, slot: PokemonSlot, kind: MarkerKind): number {
  return activeMarkers(state, slot)
    .filter((m) => m.kind === kind)
    .reduce((n, m) => n + m.amount, 0);
}

export function dealAttackDamage(
  ctx: EffectCtx,
  target: SlotRef,
  base: number,
  opts: {
    ignoreWeaknessResistance?: boolean;
    ignoreResistance?: boolean;
    ignoreDefenderEffects?: boolean;
  } = {},
): number {
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
    // "This turn" effects (e.g. Premium Power Pro) act for their owner as if in play.
    for (const l of s.lingering) {
      const hook = registry.scripts[l.defId]?.modifyOutgoingDamage;
      if (hook && l.turn === s.turn && l.owner === info.attacker.player) {
        amount = hook({
          state: s,
          holder: info.attacker,
          attacker: info.attacker,
          defender: target,
          amount,
          registry,
        });
      }
    }
    const attackerSlot = getSlot(s, info.attacker)!;
    const markerChange =
      sumMarkers(s, attackerSlot, 'increaseOutgoing') - sumMarkers(s, attackerSlot, 'reduceOutgoing');
    if (markerChange) amount = Math.max(0, amount + markerChange);
    const attackerDef = slotDef(ctx.env, s, attackerSlot);
    const defenderDef = slotDef(ctx.env, s, targetSlot);
    if (!opts.ignoreWeaknessResistance) {
      if (amount > 0 && defenderDef.weakness && attackerDef.types.includes(defenderDef.weakness)) amount *= 2;
      if (
        !opts.ignoreResistance &&
        defenderDef.resistance &&
        attackerDef.types.includes(defenderDef.resistance)
      )
        amount -= 30;
    }
    for (const h of scriptsInPlay(ctx.env, s, target.player)) {
      if (opts.ignoreDefenderEffects && sameSlot(h.ref, target)) continue;
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
    if (!opts.ignoreDefenderEffects) {
      amount -= sumMarkers(s, targetSlot, 'reduceIncoming');
      if (activeMarkers(s, targetSlot).some((m) => m.kind === 'preventDamage')) amount = 0;
      if (
        attackerDef.stage === 'Basic' &&
        activeMarkers(s, targetSlot).some((m) => m.kind === 'preventFromBasic')
      )
        amount = 0;
    }
  }
  amount = Math.max(0, amount);
  targetSlot.damage += amount;
  if (amount > 0) info.damaged.push(target);
  log(s, 'damage', `${slotDef(ctx.env, s, targetSlot).name} takes ${amount} damage`, { amount });
  return amount;
}

export function attack(ctx: EffectCtx, attackIndex: number, benchIndex?: number): void {
  const s = ctx.state;
  const me = ctx.me;
  const attackerRef: SlotRef =
    benchIndex === undefined
      ? { player: me, zone: 'active' }
      : { player: me, zone: 'bench', index: benchIndex };
  const attacker = getSlot(s, attackerRef)!;
  const def = slotDef(ctx.env, s, attacker);
  const atk = def.attacks[attackIndex]!;
  const script = ctx.env.registry.scripts[def.id]?.attacks?.[attackIndex];
  ctx.source = { kind: 'attack', slot: attackerRef, attackIndex };
  attackInfo.set(ctx, { attacker: attackerRef, attackerIsEx: def.isEx, damaged: [] });
  log(s, 'attack', `${def.name} uses ${atk.name}`, { player: me });

  if (benchIndex !== undefined || resolveConfusion(ctx)) {
    const scripted = script?.damage ? script.damage(ctx) : atk.damage;
    const base = typeof scripted === 'number' ? scripted : scripted.amount;
    const ignoreWeaknessResistance = typeof scripted === 'number' ? false : scripted.ignoreWR;
    const ignoreDefenderEffects = typeof scripted === 'number' ? false : !!scripted.ignoreDefenderEffects;
    const ignoreResistance = typeof scripted === 'number' ? false : !!scripted.ignoreResistance;
    const defenderRef: SlotRef = { player: ctx.opp, zone: 'active' };
    if (base > 0 && getSlot(s, defenderRef))
      dealAttackDamage(ctx, defenderRef, base, {
        ignoreWeaknessResistance,
        ignoreResistance,
        ignoreDefenderEffects,
      });
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
  const info = currentAttack(ctx);
  /** Whether `ref` was damaged by the attack now resolving (and that attack is an opponent's). */
  const byAttack = (ref: SlotRef): boolean =>
    !!info && ref.player !== info.attacker.player && info.damaged.some((d) => sameSlot(d, ref));
  const topDefId = (ref: SlotRef): string => {
    const slot = getSlot(s, ref)!;
    return s.cards[slot.stack[slot.stack.length - 1]!]!.defId;
  };
  const knocked: SlotRef[] = [];
  for (const player of [0, 1] as PlayerId[]) {
    for (const ref of slotRefs(s, player)) {
      const slot = getSlot(s, ref)!;
      const hp = maxHp(env, s, ref);
      if (slot.damage < hp) continue;
      if (byAttack(ref) && env.registry.scripts[topDefId(ref)]?.survivesKnockout?.(ctx, ref)) {
        slot.damage = Math.max(0, hp - 10);
        continue;
      }
      knocked.push(ref);
    }
  }
  if (info && knocked.some(byAttack)) {
    // Reactions (Weezing, Raichu): the Knocked Out Pokémon's owner's Pokémon are all still in play.
    for (const ref of knocked.filter(byAttack)) {
      for (const h of scriptsInPlay(env, s, ref.player)) {
        h.script.afterKnockout?.(ctx, { holder: h.ref, knocked: ref, attacker: info.attacker });
      }
    }
    // A reaction can Knock more Pokémon Out (it isn't damage from an attack, so nothing survives it).
    for (const player of [0, 1] as PlayerId[]) {
      for (const ref of slotRefs(s, player)) {
        if (knocked.some((k) => sameSlot(k, ref))) continue;
        if (getSlot(s, ref)!.damage >= maxHp(env, s, ref)) knocked.push(ref);
      }
    }
  }
  // Nothing to do unless a Pokémon was Knocked Out or a player is missing an Active Pokémon
  // (an Ability can discard one).
  const missingActive = ([0, 1] as PlayerId[]).some((p) => !s.players[p].active && s.phase !== 'setup');
  if (knocked.length === 0 && !missingActive) return;
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
    p.lastKnockedOutTurn = s.turn;
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
    p.active.becameActiveTurn = s.turn;
    log(s, 'promote', `Player ${player + 1} promotes ${slotDef(env, s, p.active).name}`, { player });
  }
}
