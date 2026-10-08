import type { CardScript } from '@ptcg/engine';

export const name = 'Zigzagoon';
export const script: CardScript = {
  attacks: {
    // Surprise Attack: does nothing on tails.
    0: { damage: (ctx) => (ctx.flipCoin() ? 30 : 0) },
  },
};
