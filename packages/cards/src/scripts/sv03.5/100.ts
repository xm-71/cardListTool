import type { CardScript } from '@ptcg/engine';

export const name = 'Voltorb';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Tumbling Attack: flip a coin; 20 more on heads.
    0: { damage: (ctx) => (ctx.flipCoin() ? 30 : 10) },
  },
};
