import type { CardScript } from '@ptcg/engine';
import { benchSpace, isBasicPokemonCard, searchDeck } from '../util.ts';

export const name = 'Mimikyu';
export const script: CardScript = {
  attacks: {
    // Call for Family
    0: {
      effect(ctx) {
        const [uid] = searchDeck(ctx, {
          filter: isBasicPokemonCard,
          max: Math.min(1, benchSpace(ctx, ctx.me)),
          message: 'Choose a Basic Pokémon to put on your Bench',
        });
        if (uid) ctx.putOnBench(ctx.me, uid);
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
