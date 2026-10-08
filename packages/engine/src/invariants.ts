import type { CardRegistry } from './cards.ts';
import type { GameState, PlayerId } from './types.ts';

/** Structural checks that must hold after every action. Returns human-readable violations. */
export function checkInvariants(
  state: GameState,
  registry: CardRegistry,
  deckSize = 60,
  benchSize = 5,
): string[] {
  const out: string[] = [];
  const seen = new Map<string, string>();
  const note = (uid: string, where: string, owner: PlayerId) => {
    if (seen.has(uid)) out.push(`${uid} is in both ${seen.get(uid)} and ${where}`);
    seen.set(uid, where);
    const inst = state.cards[uid];
    if (!inst) out.push(`${uid} in ${where} is not a known card`);
    else if (inst.owner !== owner) out.push(`${uid} in ${where} belongs to the other player`);
    else if (!registry.defs[inst.defId]) out.push(`${uid} has no definition`);
  };
  for (const player of [0, 1] as PlayerId[]) {
    const p = state.players[player];
    for (const zone of ['deck', 'hand', 'discard', 'prizes'] as const) {
      for (const uid of p[zone]) note(uid, `p${player}.${zone}`, player);
    }
    const slots = [...(p.active ? [p.active] : []), ...p.bench];
    slots.forEach((slot, i) => {
      const where = `p${player}.slot${i}`;
      if (slot.stack.length === 0) out.push(`${where} is empty`);
      if (slot.damage < 0) out.push(`${where} has negative damage`);
      for (const uid of [...slot.stack, ...slot.energy, ...(slot.tool ? [slot.tool] : [])])
        note(uid, where, player);
    });
    if (p.bench.length > benchSize) out.push(`p${player} has ${p.bench.length} Benched Pokémon`);
    if (state.phase === 'main' && !p.active && !state.prompt) out.push(`p${player} has no Active Pokémon`);
  }
  if (state.stadium) note(state.stadium.uid, 'stadium', state.stadium.owner);
  for (const player of [0, 1] as PlayerId[]) {
    const owned = [...seen.keys()].filter((uid) => state.cards[uid]?.owner === player).length;
    if (owned !== deckSize) out.push(`p${player} has ${owned} cards in play areas, expected ${deckSize}`);
  }
  return out;
}
