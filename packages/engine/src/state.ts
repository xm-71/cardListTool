import type { CardDef, PokemonDef } from './cards.ts';
import type { Env } from './env.ts';
import type { GameState, Marker, PlayerId, PokemonSlot, SlotRef } from './types.ts';

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

export function defOf(env: Env, state: GameState, uid: string): CardDef {
  const inst = state.cards[uid];
  if (!inst) throw new Error(`Unknown card uid ${uid}`);
  const def = env.registry.defs[inst.defId];
  if (!def) throw new Error(`No card definition for ${inst.defId}`);
  return def;
}

export function pokemonDefOf(env: Env, state: GameState, uid: string): PokemonDef {
  const def = defOf(env, state, uid);
  if (def.category !== 'Pokemon') throw new Error(`${def.name} is not a Pokémon`);
  return def;
}

export function isBasicPokemon(env: Env, state: GameState, uid: string): boolean {
  const def = defOf(env, state, uid);
  return def.category === 'Pokemon' && def.stage === 'Basic';
}

export function newSlot(uid: string, turn: number): PokemonSlot {
  return {
    stack: [uid],
    energy: [],
    tool: null,
    damage: 0,
    conditions: { rotation: 'none', poisoned: false, burned: false },
    enteredTurn: turn,
    evolvedTurn: null,
    abilityUsedTurn: {},
    cantAttackOnTurn: null,
    attackLocks: {},
    markers: [],
    becameActiveTurn: null,
  };
}

export function getSlot(state: GameState, ref: SlotRef): PokemonSlot | null {
  const p = state.players[ref.player];
  return ref.zone === 'active' ? p.active : (p.bench[ref.index] ?? null);
}

export function topUid(slot: PokemonSlot): string {
  const uid = slot.stack[slot.stack.length - 1];
  if (!uid) throw new Error('Empty Pokémon slot');
  return uid;
}

export function slotDef(env: Env, state: GameState, slot: PokemonSlot): PokemonDef {
  return pokemonDefOf(env, state, topUid(slot));
}

/** All slots a player has in play, Active first. */
export function slotRefs(state: GameState, player: PlayerId): SlotRef[] {
  const p = state.players[player];
  const refs: SlotRef[] = [];
  if (p.active) refs.push({ player, zone: 'active' });
  p.bench.forEach((_, index) => refs.push({ player, zone: 'bench', index }));
  return refs;
}

export function isFirstTurnOf(state: GameState, player: PlayerId): boolean {
  return state.turn === (player === state.first ? 1 : 2);
}

export function log(state: GameState, type: string, text: string, extra: Record<string, unknown> = {}): void {
  state.log.push({ type, text, ...extra });
}

/** A Pokémon's HP after Stadium, Tool and own-card modifiers. */
export function maxHp(env: Env, state: GameState, ref: SlotRef): number {
  const slot = getSlot(state, ref);
  if (!slot) return 0;
  let hp = slotDef(env, state, slot).hp;
  const ids = [
    ...(state.stadium ? [state.cards[state.stadium.uid]!.defId] : []),
    state.cards[topUid(slot)]!.defId,
    ...(slot.tool ? [state.cards[slot.tool]!.defId] : []),
  ];
  for (const id of ids) {
    const hook = env.registry.scripts[id]?.modifyMaxHp;
    if (hook) hp = hook({ state, slot: ref, hp, registry: env.registry });
  }
  return Math.max(0, hp);
}

/** Timed markers still in force on this turn. */
export function activeMarkers(state: GameState, slot: PokemonSlot): Marker[] {
  return slot.markers.filter((m) => state.turn <= m.untilTurn);
}

/** Effects on a Pokémon that end when it leaves the Active Spot. */
export function clearActiveEffects(slot: PokemonSlot): void {
  slot.conditions = { rotation: 'none', poisoned: false, burned: false };
  slot.cantAttackOnTurn = null;
  slot.attackLocks = {};
  slot.markers = [];
}
