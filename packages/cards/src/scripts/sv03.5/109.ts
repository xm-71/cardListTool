import type { CardScript } from '@ptcg/engine';

export const name = 'Koffing';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Suspicious Gas
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'confused') },
  },
};
