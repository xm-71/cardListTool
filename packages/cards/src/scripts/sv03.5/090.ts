import type { CardScript } from '@ptcg/engine';

export const name = 'Shellder';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Shell Press: takes 30 less damage during the opponent's next turn.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'reduceIncoming', 30) },
  },
};
