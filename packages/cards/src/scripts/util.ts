import type {
  CardDef,
  CardRegistry,
  EffectCtx,
  EnergyType,
  GameState,
  PlayerId,
  PokemonDef,
  SlotRef,
} from '@ptcg/engine';

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

/** Top Pokémon definition at a slot, for passive hooks that only get state + registry. */
export function defAt(state: GameState, registry: CardRegistry, ref: SlotRef): PokemonDef | null {
  const p = state.players[ref.player];
  const slot = ref.zone === 'active' ? p.active : p.bench[ref.index];
  if (!slot) return null;
  const d = registry.defs[state.cards[slot.stack[slot.stack.length - 1]!]!.defId];
  return d?.category === 'Pokemon' ? d : null;
}

/** Refs of a player's Pokémon in play, Active first, from state alone. */
export function refsOf(state: GameState, player: PlayerId): SlotRef[] {
  const p = state.players[player];
  return [
    ...(p.active ? [{ player, zone: 'active' } as SlotRef] : []),
    ...p.bench.map((_, index) => ({ player, zone: 'bench', index }) as SlotRef),
  ];
}

export function sameRef(a: SlotRef, b: SlotRef): boolean {
  return (
    a.player === b.player &&
    a.zone === b.zone &&
    (a.zone === 'active' || a.index === (b as { index: number }).index)
  );
}

/** The Pokémon slot at `ref`, from state alone. */
export function slotAt(state: GameState, ref: SlotRef) {
  const p = state.players[ref.player];
  return ref.zone === 'active' ? p.active : (p.bench[ref.index] ?? null);
}

/** Energy cards attached to the Pokémon at `ref` that provide `type`. */
export function energyOfType(ctx: EffectCtx, ref: SlotRef, type: EnergyType): string[] {
  return ctx.slot(ref).energy.filter((u) => {
    const d = ctx.def(u);
    return d.category === 'Energy' && d.provides.includes(type);
  });
}

/** The Pokémon using the Ability currently resolving or being checked. */
export function abilityHolder(ctx: EffectCtx): SlotRef {
  const src = ctx.source;
  if (src?.kind !== 'ability') throw new Error('Not an Ability');
  return src.slot;
}

/** Call for Family: search the deck for up to `n` Basic Pokémon, put them onto the Bench, then shuffle. */
export function callForFamily(ctx: EffectCtx, n: number): void {
  const picks = searchDeck(ctx, {
    filter: isBasicPokemonCard,
    max: Math.min(n, benchSpace(ctx, ctx.me)),
    message: `Choose up to ${n} Basic Pokémon to put on your Bench`,
  });
  for (const uid of picks) ctx.putOnBench(ctx.me, uid);
  ctx.shuffleDeck(ctx.me);
}

/** Whether the player has any Mega Evolution Pokémon ex in play (optionally of one type). */
export function hasMegaEx(ctx: EffectCtx, player: PlayerId, type?: EnergyType): boolean {
  return inPlayRefs(ctx, player).some((ref) => {
    const d = topDef(ctx, ref);
    return d.isMega && d.isEx && (!type || d.types.includes(type));
  });
}

/** Flip `n` coins; returns the number of heads. */
export function countHeads(ctx: EffectCtx, n: number): number {
  let heads = 0;
  for (let i = 0; i < n; i++) if (ctx.flipCoin()) heads++;
  return heads;
}
