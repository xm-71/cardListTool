import type { CardScript } from '@ptcg/engine';

export const name = 'Skarmory';
export const set = 'sv08';
export const script: CardScript = {
  attacks: {
    // Steel Wing: during your opponent's next turn, this Pokémon takes 30 less damage from attacks.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'reduceIncoming', 30) },
  },
};
