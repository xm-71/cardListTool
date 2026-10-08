import type { CardScript } from '@ptcg/engine';

export const name = 'Spoink';
export const script: CardScript = {
  attacks: {
    // Triple Spin
    0: {
      damage(ctx) {
        let heads = 0;
        for (let i = 0; i < 3; i++) if (ctx.flipCoin()) heads++;
        return 10 * heads;
      },
    },
  },
};
