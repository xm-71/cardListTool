import type { CardScript } from '@ptcg/engine';
import { otherCardsInHand, searchDeck } from '../util.ts';

export const name = 'Ultra Ball';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => otherCardsInHand(ctx).length >= 2,
    play(ctx) {
      const discard = ctx.chooseCards({
        player: ctx.me,
        from: otherCardsInHand(ctx),
        min: 2,
        max: 2,
        message: 'Choose 2 cards to discard',
      });
      for (const uid of discard) ctx.moveCard(uid, { player: ctx.me, zone: 'discard' });
      const [found] = searchDeck(ctx, {
        filter: (d) => d.category === 'Pokemon',
        max: 1,
        message: 'Choose a Pokémon',
      });
      if (found) ctx.moveCard(found, { player: ctx.me, zone: 'hand' });
      ctx.shuffleDeck(ctx.me);
    },
  },
};
