import type { CardScript } from '@ptcg/engine';

export const name = 'Magnemite';
export const script: CardScript = {
  attacks: {
    // Big Explosion: this Pokémon also does 60 damage to itself.
    1: { effect: (ctx) => ctx.damageSelf(60) },
  },
};
