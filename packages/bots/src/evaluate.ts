import {
  maxHp,
  standard2026,
  type CardRegistry,
  type Engine,
  type GameState,
  type PlayerId,
  type PokemonDef,
  type SlotRef,
} from '@ptcg/engine';
import { estimateDamage, type DamageCache } from './damage.ts';
import type { DeckPlan } from './plan.ts';
import { trainerRole } from './roles.ts';

/** What the smarter scoring needs: an engine to play attacks out in, the damage cache and both seats' plans. */
export interface EvalContext {
  engine: Engine;
  damage: DamageCache;
  plans: [DeckPlan, DeckPlan];
}

/** Today's heuristic, kept as it was (Easy-rollout Hard and the strength comparison use it). */
export function evaluateLegacy(state: GameState, me: PlayerId, registry: CardRegistry): number {
  return evaluate(state, me, registry);
}

/**
 * Heuristic value of `state` for `me` (higher is better). With `ctx` it also sees scripted damage, counts the
 * Knock Outs each side still needs, and values a board and hand by the deck's plan.
 */
export function evaluate(state: GameState, me: PlayerId, registry: CardRegistry, ctx?: EvalContext): number {
  const opp: PlayerId = me === 0 ? 1 : 0;
  if (state.result) return state.result.winner === me ? 100000 : state.result.winner === 'draw' ? 0 : -100000;
  const env = { registry, ruleset: standard2026 };
  // Prizes taken by me minus Prizes taken by the opponent.
  let score = 100 * (state.players[opp].prizes.length - state.players[me].prizes.length);
  const slots = (p: PlayerId): SlotRef[] => [
    ...(state.players[p].active ? [{ player: p, zone: 'active' } as SlotRef] : []),
    ...state.players[p].bench.map((_, index) => ({ player: p, zone: 'bench', index }) as SlotRef),
  ];
  for (const ref of slots(opp)) {
    const slot = ref.zone === 'active' ? state.players[opp].active! : state.players[opp].bench[ref.index]!;
    const hp = Math.max(1, maxHp(env, state, ref));
    score += (ref.zone === 'active' ? 0.5 : 0.2) * slot.damage + (slot.damage / hp) * 10;
  }
  for (const ref of slots(me)) {
    const slot = ref.zone === 'active' ? state.players[me].active! : state.players[me].bench[ref.index]!;
    score -= 0.3 * slot.damage;
    const def = registry.defs[state.cards[slot.stack[slot.stack.length - 1]!]!.defId];
    const canAttack =
      def?.category === 'Pokemon' && def.attacks.some((a) => a.cost.length <= slot.energy.length);
    score += slot.energy.length * (canAttack ? 6 : 3);
    if (def?.category === 'Pokemon' && def.stage !== 'Basic') score += 8;
  }
  // Threats: can each Active Knock Out the other next turn (one more Energy allowed for the opponent)?
  const best = (p: PlayerId, extraEnergy: number): number => {
    const atk = state.players[p].active;
    const def = state.players[p === 0 ? 1 : 0].active;
    if (!atk || !def) return 0;
    const a = registry.defs[state.cards[atk.stack[atk.stack.length - 1]!]!.defId];
    const d = registry.defs[state.cards[def.stack[def.stack.length - 1]!]!.defId];
    if (a?.category !== 'Pokemon' || d?.category !== 'Pokemon') return 0;
    let dmg = 0;
    for (const [i, at] of a.attacks.entries()) {
      if (at.cost.length > atk.energy.length + extraEnergy) continue;
      let x = ctx
        ? estimateDamage(ctx.engine, state, { player: p, zone: 'active' }, i, ctx.damage, extraEnergy)
        : at.damage;
      if (d.weakness && a.types.includes(d.weakness)) x *= 2;
      if (d.resistance && a.types.includes(d.resistance)) x -= 30;
      dmg = Math.max(dmg, x);
    }
    return dmg;
  };
  const remaining = (p: PlayerId): number => {
    const slot = state.players[p].active;
    return slot ? maxHp(env, state, { player: p, zone: 'active' }) - slot.damage : Infinity;
  };
  const prizeValue = (p: PlayerId): number => {
    const slot = state.players[p].active;
    const d = slot && registry.defs[state.cards[slot.stack[slot.stack.length - 1]!]!.defId];
    return d?.category === 'Pokemon' ? standard2026.prizeValue(d) : 1;
  };
  if (best(me, 0) >= remaining(opp)) score += 40 * prizeValue(opp);
  if (best(opp, 1) >= remaining(me)) score -= 60 * prizeValue(me);
  score += 4 * state.players[me].bench.length - 2 * state.players[opp].bench.length;
  if (ctx) score += planTerms(state, me, registry, ctx);
  else score += Math.min(8, state.players[me].hand.length);
  if (state.players[me].deck.length < 8) score -= (8 - state.players[me].deck.length) * 6;
  if (!state.players[me].active) score -= 50;
  return score;
}

const prizeOf = (d: PokemonDef): number => standard2026.prizeValue(d);

/** Knock Outs `p` still needs: the biggest Prize values among the other side's Pokémon first, then 1 per new one. */
function knockOutsNeeded(state: GameState, p: PlayerId, registry: CardRegistry): number {
  const other = state.players[p === 0 ? 1 : 0];
  const values = [other.active, ...other.bench]
    .flatMap((slot) => {
      const d = slot && registry.defs[state.cards[slot.stack[slot.stack.length - 1]!]!.defId];
      return d?.category === 'Pokemon' ? [prizeOf(d)] : [];
    })
    .sort((a, b) => b - a);
  let remaining = state.players[p].prizes.length;
  let kos = 0;
  for (const v of values) {
    if (remaining <= 0) break;
    remaining -= v;
    kos++;
  }
  return kos + Math.max(0, remaining);
}

/** Terms that need the deck's plan: the Prize map, off-plan ex on the Bench, setup, and a useful hand. */
function planTerms(state: GameState, me: PlayerId, registry: CardRegistry, ctx: EvalContext): number {
  const opp: PlayerId = me === 0 ? 1 : 0;
  const plan = ctx.plans[me];
  const defOf = (uid: string) => registry.defs[state.cards[uid]!.defId]!;
  const topDef = (slot: { stack: string[] }) => defOf(slot.stack[slot.stack.length - 1]!);
  const inPlan = (name: string) =>
    plan.attackers.some((a) => (plan.lines[a] ?? [a]).includes(name)) || plan.support.includes(name);
  let score = 30 * (knockOutsNeeded(state, opp, registry) - knockOutsNeeded(state, me, registry));

  const bench = state.players[me].bench;
  const handNames = new Set(state.players[me].hand.map((u) => defOf(u).name));
  let readyAttacker = false;
  let evolutionInHand = false;
  for (const slot of bench) {
    const d = topDef(slot);
    if (d.category !== 'Pokemon') continue;
    if ((d.isEx || d.isMega) && !inPlan(d.name)) score -= 15;
    const line = plan.attackers.map((a) => plan.lines[a] ?? [a]).find((l) => l.includes(d.name));
    if (line && slot.energy.length > 0) readyAttacker = true;
    if (line && handNames.has(line[line.indexOf(d.name) + 1] ?? '')) evolutionInHand = true;
  }
  if (readyAttacker) score += 10;
  if (evolutionInHand) score += 6;

  // A hand is worth the cards the deck can use: plan Pokémon, Energy and working Trainers.
  const useful = state.players[me].hand.filter((u) => {
    const d = defOf(u);
    if (d.category === 'Pokemon') return plan.priority.includes(d.name);
    if (d.category === 'Energy') return true;
    return trainerRole(d) !== 'other' || d.trainerType !== 'Item';
  }).length;
  return score + Math.min(8, useful);
}
