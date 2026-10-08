import type { CardScript } from '@ptcg/engine';

export const name = 'Bulbasaur';
export const script: CardScript = {
  attacks: {
    // Bind Down
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.opp, zone: 'active' }, 'cantRetreat') },
  },
};
