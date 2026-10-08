import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy, searchDeck } from '../util.ts';

export const name = 'Cresselia';
export const script: CardScript = {
  attacks: {
    // Swelling Light
    0: {
      effect(ctx) {
        const picks = searchDeck(ctx, {
          filter: (d) => isBasicEnergy(d, 'Psychic'),
          max: 2,
          message: 'Choose up to 2 Basic {P} Energy',
        });
        for (const uid of picks) ctx.attachEnergy(uid, { player: ctx.me, zone: 'active' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
