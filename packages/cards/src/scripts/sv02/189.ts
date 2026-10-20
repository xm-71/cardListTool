import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy, otherCardsInHand } from '../util.ts';

export const name = 'Superior Energy Retrieval';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => otherCardsInHand(ctx).length >= 2,
    play(ctx) {
      const cost = ctx.chooseCards({
        player: ctx.me,
        from: otherCardsInHand(ctx),
        min: 2,
        max: 2,
        message: 'Choose 2 cards to discard',
      });
      for (const uid of cost) ctx.moveCard(uid, { player: ctx.me, zone: 'discard' });
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: ctx.state.players[ctx.me].discard.filter(
          (u) => !cost.includes(u) && isBasicEnergy(ctx.def(u)),
        ),
        min: 0,
        max: 4,
        message: 'Choose up to 4 Basic Energy cards to put into your hand',
      });
      for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
    },
  },
};
