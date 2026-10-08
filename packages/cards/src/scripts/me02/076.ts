import type { CardScript } from '@ptcg/engine';

export const name = 'Jigglypuff';
export const script: CardScript = {
  attacks: {
    // Ball Roll: flip until tails; 20 for each heads.
    0: {
      damage(ctx) {
        let heads = 0;
        while (heads < 100 && ctx.flipCoin()) heads++;
        return 20 * heads;
      },
    },
  },
};
