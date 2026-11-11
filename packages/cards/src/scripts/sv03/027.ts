import type { CardScript } from '@ptcg/engine';

export const name = 'Charmeleon';
export const script: CardScript = {
  attacks: {
    // Heat Tackle: this Pokémon also does 20 damage to itself.
    0: { effect: (ctx) => ctx.damageSelf(20) },
  },
};
