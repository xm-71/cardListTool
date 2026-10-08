import type { CardDef, EffectCtx, EnergyType, PlayerId, PokemonDef, SlotRef } from '@ptcg/engine';

export function pokemonDef(ctx: EffectCtx, uid: string): PokemonDef | null {
  const d = ctx.def(uid);
  return d.category === 'Pokemon' ? d : null;
}

export function isBasicPokemonCard(d: CardDef): boolean {
  return d.category === 'Pokemon' && d.stage === 'Basic';
}

export function isBasicEnergy(d: CardDef, type?: EnergyType): boolean {
  return d.category === 'Energy' && d.energyKind === 'Basic' && (!type || d.provides.includes(type));
}

export function benchSpace(ctx: EffectCtx, player: PlayerId): number {
  return ctx.env.ruleset.benchSize - ctx.state.players[player].bench.length;
}

/** Search the player's deck for up to `max` cards matching `filter` (finding nothing is allowed). Does not shuffle. */
export function searchDeck(
  ctx: EffectCtx,
  o: { player?: PlayerId; filter: (d: CardDef) => boolean; max: number; message: string },
): string[] {
  const player = o.player ?? ctx.me;
  const from = ctx.state.players[player].deck.filter((uid) => o.filter(ctx.def(uid)));
  return ctx.chooseCards({ player, from, min: 0, max: o.max, message: o.message });
}

export function benchRefs(ctx: EffectCtx, player: PlayerId): SlotRef[] {
  return ctx.state.players[player].bench.map((_, index) => ({ player, zone: 'bench', index }) as SlotRef);
}

export function inPlayRefs(ctx: EffectCtx, player: PlayerId): SlotRef[] {
  const p = ctx.state.players[player];
  return [...(p.active ? [{ player, zone: 'active' } as SlotRef] : []), ...benchRefs(ctx, player)];
}

export function topDef(ctx: EffectCtx, ref: SlotRef): PokemonDef {
  const slot = ctx.slot(ref);
  return pokemonDef(ctx, slot.stack[slot.stack.length - 1]!)!;
}

/** Hand size excluding the Trainer card currently being checked/played. */
export function otherCardsInHand(ctx: EffectCtx): string[] {
  const src = ctx.source;
  const self = src?.kind === 'trainer' ? src.uid : null;
  return ctx.state.players[ctx.me].hand.filter((u) => u !== self);
}
