import type { CardScript } from '@ptcg/engine';

export const name = 'Venomoth';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Perplexing Powder: the Defending Pokémon is now Confused; during their next turn they can't play Item cards.
    0: {
      effect(ctx) {
        ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'confused');
        ctx.lockItems(ctx.opp);
      },
    },
  },
};
