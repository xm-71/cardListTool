import type { CardScript } from '@ptcg/engine';

export const name = 'Exeggcute';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Ball Roll: flip until tails; 30 for each heads.
    0: {
      damage(ctx) {
        let heads = 0;
        while (ctx.flipCoin()) heads++;
        return 30 * heads;
      },
    },
  },
};
