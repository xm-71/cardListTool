import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy, otherCardsInHand, searchDeck } from '../util.ts';

export const name = 'Earthen Vessel';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => otherCardsInHand(ctx).length >= 1,
    play(ctx) {
      const [cost] = ctx.chooseCards({
        player: ctx.me,
        from: otherCardsInHand(ctx),
        min: 1,
        max: 1,
        message: 'Choose a card to discard',
      });
      if (cost) ctx.moveCard(cost, { player: ctx.me, zone: 'discard' });
      const picks = searchDeck(ctx, {
        filter: (d) => isBasicEnergy(d),
        max: 2,
        message: 'Choose up to 2 Basic Energy cards',
      });
      if (picks.length > 0) {
        ctx.reveal(picks);
        for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      }
      ctx.shuffleDeck(ctx.me);
    },
  },
};
