import type { CardScript } from '@ptcg/engine';

export const name = 'Squirtle';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Withdraw: flip a coin; on heads prevent all damage done to this Pokémon by attacks during the opponent's next turn.
    0: {
      effect(ctx) {
        if (ctx.flipCoin()) ctx.addMarker({ player: ctx.me, zone: 'active' }, 'preventDamage');
      },
    },
  },
};
