import type { CardScript } from '@ptcg/engine';

export const name = 'Charmander';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Blazing Destruction: discard a Stadium in play.
    0: { effect: (ctx) => ctx.discardStadium() },
  },
};
