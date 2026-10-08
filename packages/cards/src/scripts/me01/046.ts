import type { CardScript } from '@ptcg/engine';

export const name = 'Magneton';
export const script: CardScript = {
  attacks: {
    // Thunder Shock
    0: {
      effect(ctx) {
        if (ctx.flipCoin()) ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'paralyzed');
      },
    },
  },
};
