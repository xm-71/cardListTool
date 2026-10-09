import type { CardScript } from '@ptcg/engine';

export const name = 'Bulbasaur';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Leech Seed: heal 20 damage from this Pokémon.
    0: { effect: (ctx) => ctx.heal({ player: ctx.me, zone: 'active' }, 20) },
  },
};
