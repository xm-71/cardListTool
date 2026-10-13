import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Noctowl';
export const set = 'sv05';
export const script: CardScript = {
  attacks: {
    // Talon Hunt: you may search your deck for up to 2 cards and put them into your hand.
    0: {
      effect(ctx) {
        const found = searchDeck(ctx, { filter: () => true, max: 2, message: 'Choose up to 2 cards' });
        for (const uid of found) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
