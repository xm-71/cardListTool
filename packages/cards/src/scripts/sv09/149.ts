import type { CardScript } from '@ptcg/engine';
import { otherCardsInHand } from '../util.ts';

export const name = "Iris's Fighting Spirit";
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => otherCardsInHand(ctx).length >= 1,
    play(ctx) {
      const [discard] = ctx.chooseCards({
        player: ctx.me,
        from: otherCardsInHand(ctx),
        min: 1,
        max: 1,
        message: 'Choose a card to discard',
      });
      ctx.moveCard(discard!, { player: ctx.me, zone: 'discard' });
      ctx.draw(ctx.me, 6 - ctx.state.players[ctx.me].hand.length);
    },
  },
};
