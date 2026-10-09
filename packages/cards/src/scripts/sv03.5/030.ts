import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Nidorina';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Fetch Family: search your deck for up to 3 Pokémon, reveal them, and put them into your hand.
    0: {
      effect(ctx) {
        const picks = searchDeck(ctx, {
          filter: (d) => d.category === 'Pokemon',
          max: 3,
          message: 'Choose up to 3 Pokémon',
        });
        ctx.reveal(picks);
        for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
