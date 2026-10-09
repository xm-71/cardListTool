import type { CardScript } from '@ptcg/engine';

export const name = 'Cloyster';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Protect Charge: takes 80 less damage during the opponent's next turn.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'reduceIncoming', 80) },
  },
};
