import type { CardScript } from '@ptcg/engine';
import { benchSpace, isBasicPokemonCard, searchDeck } from '../util.ts';

export const name = 'Artazon';
export const script: CardScript = {
  stadium: {
    // Once during each player's turn, that player may search their deck for a Basic Pokémon without a Rule Box
    // and put it onto their Bench.
    canUse: (ctx) =>
      benchSpace(ctx, ctx.me) > 0 &&
      ctx.state.players[ctx.me].deck.some((u) => {
        const d = ctx.def(u);
        return isBasicPokemonCard(d) && d.category === 'Pokemon' && !d.isEx;
      }),
    use(ctx) {
      const [uid] = searchDeck(ctx, {
        filter: (d) => isBasicPokemonCard(d) && d.category === 'Pokemon' && !d.isEx,
        max: 1,
        message: 'Choose a Basic Pokémon without a Rule Box to put on your Bench',
      });
      if (uid) ctx.putOnBench(ctx.me, uid);
      ctx.shuffleDeck(ctx.me);
    },
  },
};
