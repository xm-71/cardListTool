import type { CardScript } from '@ptcg/engine';

export const name = 'Milcery';
export const script: CardScript = {
  attacks: {
    // Draining Kiss
    0: { effect: (ctx) => ctx.heal({ player: ctx.me, zone: 'active' }, 10) },
  },
};
