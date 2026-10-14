import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Zubat';
export const set = 'sv06.5';
export const script: CardScript = {
  attacks: {
    // Lead: search your deck for a Supporter card, reveal it, and put it into your hand. Then shuffle your deck.
    0: {
      effect(ctx) {
        const [uid] = searchDeck(ctx, {
          filter: (d) => d.category === 'Trainer' && d.trainerType === 'Supporter',
          max: 1,
          message: 'Choose a Supporter card',
        });
        if (uid) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
