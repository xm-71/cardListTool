import type { CardScript } from '@ptcg/engine';

export const name = 'Graveler';
export const script: CardScript = {
  attacks: {
    // Rock Cannon: flip until tails; 40 for each heads.
    0: {
      damage(ctx) {
        let heads = 0;
        while (ctx.flipCoin()) heads++;
        return 40 * heads;
      },
    },
  },
};
