import type { CardScript } from '@ptcg/engine';

export const name = 'Eiscue';
export const script: CardScript = {
  attacks: {
    // Freezing Headbutt
    0: {
      effect(ctx) {
        if (ctx.flipCoin()) ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'paralyzed');
      },
    },
  },
};
