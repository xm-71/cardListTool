import type { CardScript } from '@ptcg/engine';

export const name = 'Magneton';
export const script: CardScript = {
  attacks: {
    // Junk Magnet: put up to 2 Item cards from your discard pile into your hand.
    0: {
      effect(ctx) {
        const items = ctx.state.players[ctx.me].discard.filter((uid) => {
          const d = ctx.def(uid);
          return d.category === 'Trainer' && d.trainerType === 'Item';
        });
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: items,
          min: 0,
          max: 2,
          message: 'Choose up to 2 Item cards',
        });
        for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      },
    },
  },
};
