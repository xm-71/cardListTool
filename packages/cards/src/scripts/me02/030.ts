import type { CardScript } from '@ptcg/engine';

export const name = 'Yamper';
export const script: CardScript = {
  attacks: {
    // Play Rough
    0: { damage: (ctx) => (ctx.flipCoin() ? 40 : 20) },
  },
};
