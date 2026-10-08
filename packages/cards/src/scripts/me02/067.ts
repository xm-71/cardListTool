import type { CardScript } from '@ptcg/engine';
import { benchSpace, isBasicPokemonCard, searchDeck } from '../util.ts';

export const name = 'Toxel';
export const script: CardScript = {
  attacks: {
    // Call for Family
    0: {
      effect(ctx) {
        const picks = searchDeck(ctx, {
          filter: isBasicPokemonCard,
          max: Math.min(2, benchSpace(ctx, ctx.me)),
          message: 'Choose up to 2 Basic Pokémon to put on your Bench',
        });
        for (const uid of picks) ctx.putOnBench(ctx.me, uid);
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
