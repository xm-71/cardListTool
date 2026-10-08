import type { CardDef, CardInstance, PlayerView, PokemonDef, SlotRef, SlotView } from '@ptcg/engine';
import { registry } from './catalog.ts';

export const defOf = (card: CardInstance): CardDef => registry.defs[card.defId]!;

export const topCard = (slot: SlotView): CardInstance => slot.stack[slot.stack.length - 1]!;
export const topDef = (slot: SlotView): PokemonDef => defOf(topCard(slot)) as PokemonDef;

/** The slot a ref points to, from the viewer's perspective. */
export function slotAt(view: PlayerView, ref: SlotRef): SlotView | null {
  const side = ref.player === view.me ? view.you : view.opponent;
  return ref.zone === 'active' ? side.active : (side.bench[ref.index] ?? null);
}

/** Every card instance the viewer can see, by uid. */
export function visibleCards(view: PlayerView): Map<string, CardInstance> {
  const out = new Map<string, CardInstance>();
  const add = (c: CardInstance | null | undefined) => c && out.set(c.uid, c);
  for (const side of [view.you, view.opponent]) {
    for (const slot of [side.active, ...side.bench]) {
      if (!slot) continue;
      slot.stack.forEach(add);
      slot.energy.forEach(add);
      add(slot.tool);
    }
    side.discard.forEach(add);
  }
  view.you.hand.forEach(add);
  add(view.stadium?.card);
  return out;
}

export const sameRef = (a: SlotRef, b: SlotRef | undefined): boolean =>
  !!b &&
  a.player === b.player &&
  a.zone === b.zone &&
  (a.zone === 'active' || a.index === (b as { index: number }).index);
