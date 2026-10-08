import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Celebi';
export const script: CardScript = {
  attacks: {
    // Traverse Time
    0: {
      effect(ctx) {
        const picks = searchDeck(ctx, {
          filter: (d) =>
            (d.category === 'Pokemon' && d.types.includes('Grass')) ||
            (d.category === 'Trainer' && d.trainerType === 'Stadium'),
          max: 3,
          message: 'Choose up to 3 {G} Pokémon and Stadium cards',
        });
        ctx.reveal(picks);
        for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
