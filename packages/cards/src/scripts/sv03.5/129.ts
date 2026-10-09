import type { CardScript } from '@ptcg/engine';

export const name = 'Magikarp';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Splashy Splash: flip until tails; draw a card for each heads.
    0: {
      effect(ctx) {
        let heads = 0;
        while (ctx.flipCoin()) heads++;
        if (heads > 0) ctx.draw(ctx.me, heads);
      },
    },
  },
};
