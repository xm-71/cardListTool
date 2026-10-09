import type { CardScript } from '@ptcg/engine';

export const name = 'Nidoran♀';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Poison Horn
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'poisoned') },
  },
};
