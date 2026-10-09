import type { CardScript } from '@ptcg/engine';

export const name = 'Geodude';
export const script: CardScript = {
  attacks: {
    // Stiffen: takes 30 less damage during the opponent's next turn.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'reduceIncoming', 30) },
  },
};
