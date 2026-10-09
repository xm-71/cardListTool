import type { CardScript } from '@ptcg/engine';

export const name = 'Nidoqueen';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Queen Press: prevent damage done to this Pokémon by attacks from Basic Pokémon during the opponent's next turn.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'preventFromBasic') },
  },
};
