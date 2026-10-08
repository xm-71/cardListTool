import type { CardScript } from './cards.ts';
import type { Env } from './env.ts';
import { getSlot, slotRefs } from './state.ts';
import type { GameState, PlayerId, SlotRef } from './types.ts';

export interface InPlayScript {
  ref: SlotRef;
  /** uid of the card carrying the script (the top Pokémon or its Tool). */
  uid: string;
  script: CardScript;
}

/** Scripts on a player's Pokémon in play (top card of each slot) and their attached Tools. */
export function scriptsInPlay(env: Env, state: GameState, player: PlayerId): InPlayScript[] {
  const out: InPlayScript[] = [];
  for (const ref of slotRefs(state, player)) {
    const slot = getSlot(state, ref)!;
    const uids = [slot.stack[slot.stack.length - 1]!, ...(slot.tool ? [slot.tool] : [])];
    for (const uid of uids) {
      const script = env.registry.scripts[state.cards[uid]!.defId];
      if (script) out.push({ ref, uid, script });
    }
  }
  return out;
}

export function sameSlot(a: SlotRef, b: SlotRef): boolean {
  return (
    a.player === b.player &&
    a.zone === b.zone &&
    (a.zone === 'active' || a.index === (b as { index: number }).index)
  );
}
