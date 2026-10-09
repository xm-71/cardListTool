import type { CardScript } from '@ptcg/engine';

export const name = 'Tentacruel';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Poisonous Whip
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'poisoned') },
    // Tentacular Panic: flip until tails, 90 for each heads; Confused if the first flip is tails.
    1: {
      damage(ctx) {
        let heads = 0;
        while (ctx.flipCoin()) heads++;
        if (heads === 0) ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'confused');
        return 90 * heads;
      },
    },
  },
};
