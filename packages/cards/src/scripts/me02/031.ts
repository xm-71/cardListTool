import type { CardScript } from '@ptcg/engine';

export const name = 'Boltund';
export const script: CardScript = {
  attacks: {
    // Electric Run
    0: { damage: (ctx) => (ctx.flipCoin() ? 140 : 70) },
  },
};
