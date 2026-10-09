import type { CardScript } from '@ptcg/engine';

export const name = 'Vulpix';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Super Singe: flip a coin; heads burns the Defending Pokémon.
    0: {
      effect(ctx) {
        if (ctx.flipCoin()) ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'burned');
      },
    },
  },
};
