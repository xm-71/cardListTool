import type { CardScript } from '@ptcg/engine';

export const name = 'Electrike';
export const script: CardScript = {
  attacks: {
    // Thunder Jolt
    0: { effect: (ctx) => ctx.damageSelf(10) },
  },
};
