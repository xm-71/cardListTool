import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Lapras';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Hop on My Back: search your deck for up to 2 Pokémon, reveal them, and put them into your hand.
    0: {
      effect(ctx) {
        const picks = searchDeck(ctx, {
          filter: (d) => d.category === 'Pokemon',
          max: 2,
          message: 'Choose up to 2 Pokémon',
        });
        ctx.reveal(picks);
        for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
