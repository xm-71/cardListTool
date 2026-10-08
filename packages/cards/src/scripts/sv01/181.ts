import type { CardScript } from '@ptcg/engine';
import { benchSpace, isBasicPokemonCard, searchDeck } from '../util.ts';

export const name = 'Nest Ball';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => benchSpace(ctx, ctx.me) > 0,
    play(ctx) {
      const [uid] = searchDeck(ctx, {
        filter: isBasicPokemonCard,
        max: 1,
        message: 'Choose a Basic Pokémon to put on your Bench',
      });
      if (uid) ctx.putOnBench(ctx.me, uid);
      ctx.shuffleDeck(ctx.me);
    },
  },
};
