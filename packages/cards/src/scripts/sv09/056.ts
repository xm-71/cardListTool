import type { CardScript } from '@ptcg/engine';

export const name = "Lillie's Clefairy ex";
export const set = 'sv09';
export const script: CardScript = {
  // Fairy Zone: the Weakness of each of your opponent's {N} Pokémon in play is now {P}.
  modifyWeakness(q) {
    const def = q.registry.defs[q.state.cards[q.defenderTop]!.defId];
    return def?.category === 'Pokemon' && def.types.includes('Dragon') ? 'Psychic' : q.weakness;
  },
  attacks: {
    // Full Moon Rondo: 20 more damage for each Benched Pokémon (both yours and your opponent's).
    0: { damage: (ctx) => 20 + 20 * (ctx.state.players[0].bench.length + ctx.state.players[1].bench.length) },
  },
};
