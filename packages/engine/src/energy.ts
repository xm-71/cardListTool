import type { CardRegistry } from './cards.ts';
import { activeMarkers, getSlot, slotRefs } from './state.ts';
import type { EnergyType, GameState, SlotRef } from './types.ts';

function provided(uid: string, state: GameState, registry: CardRegistry): EnergyType[] {
  const def = registry.defs[state.cards[uid]!.defId];
  return def?.category === 'Energy' ? def.provides : [];
}

/** Can the attached Energy cards pay `cost`? Typed symbols need a matching type, Colorless takes any. */
export function canPayCost(
  cost: EnergyType[],
  energyUids: string[],
  state: GameState,
  registry: CardRegistry,
): boolean {
  const pool = energyUids.map((uid) => provided(uid, state, registry));
  const typed = cost.filter((c) => c !== 'Colorless');
  // Fill typed symbols first, preferring single-type cards so multi-type cards stay flexible.
  pool.sort((a, b) => a.length - b.length);
  const used = new Set<number>();
  for (const t of typed) {
    const i = pool.findIndex((types, idx) => !used.has(idx) && types.includes(t));
    if (i < 0) return false;
    used.add(i);
  }
  const colorless = cost.length - typed.length;
  return pool.length - used.size >= colorless;
}

/** Retreat cost after Tool / Pokémon modifiers, never below 0. */
export function getRetreatCost(state: GameState, ref: SlotRef, registry: CardRegistry): number {
  const slot = getSlot(state, ref);
  if (!slot) return 0;
  const top = registry.defs[state.cards[slot.stack[slot.stack.length - 1]!]!.defId];
  if (top?.category !== 'Pokemon') return 0;
  let cost = top.retreat;
  const scriptIds = [top.id, ...(slot.tool ? [state.cards[slot.tool]!.defId] : [])];
  for (const id of scriptIds) {
    const hook = registry.scripts[id]?.modifyRetreatCost;
    if (hook) cost = hook({ state, slot: ref, cost, registry });
  }
  for (const holder of slotRefs(state, ref.player)) {
    const held = getSlot(state, holder)!;
    const id = state.cards[held.stack[held.stack.length - 1]!]!.defId;
    const hook = registry.scripts[id]?.modifyAllRetreatCosts;
    if (hook) cost = hook({ state, holder, slot: ref, cost, registry });
  }
  cost += activeMarkers(state, slot)
    .filter((m) => m.kind === 'retreatCostMore')
    .reduce((n, m) => n + m.amount, 0);
  return Math.max(0, cost);
}
