import type { CardScript } from '@ptcg/engine';

export const name = 'Dunsparce';
export const set = 'sv05';
export const script: CardScript = {
  attacks: {
    // Dig: flip a coin; if heads, prevent all damage done to this Pokémon during your opponent's next turn.
    1: {
      effect(ctx) {
        if (ctx.flipCoin()) ctx.addMarker({ player: ctx.me, zone: 'active' }, 'preventDamage');
      },
    },
  },
};
