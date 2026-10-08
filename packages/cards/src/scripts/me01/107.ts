import type { CardScript } from '@ptcg/engine';

export const name = 'Buneary';
export const script: CardScript = {
  attacks: {
    // Charm
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.opp, zone: 'active' }, 'reduceOutgoing', 20) },
  },
};
