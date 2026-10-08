import {
  maxHp,
  standard2026,
  type CardRegistry,
  type GameState,
  type PlayerId,
  type SlotRef,
} from '@ptcg/engine';

/** Heuristic value of `state` for `me` (higher is better). */
export function evaluate(state: GameState, me: PlayerId, registry: CardRegistry): number {
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
    for (const at of a.attacks) {
      if (at.cost.length > atk.energy.length + extraEnergy) continue;
      let x = at.damage;
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
  score += Math.min(8, state.players[me].hand.length);
  if (state.players[me].deck.length < 8) score -= (8 - state.players[me].deck.length) * 6;
  if (!state.players[me].active) score -= 50;
  return score;
}
