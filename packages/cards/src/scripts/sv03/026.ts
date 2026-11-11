import type { CardScript } from '@ptcg/engine';

export const name = 'Charmander';
export const set = 'sv03';
export const script: CardScript = {
  attacks: {
    // Heat Tackle: this Pokémon also does 10 damage to itself.
    0: { effect: (ctx) => ctx.damageSelf(10) },
  },
};
