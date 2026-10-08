import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy, searchDeck } from '../util.ts';

export const name = 'Exeggcute';
export const script: CardScript = {
  attacks: {
    // Jam-Packed
    0: {
      effect(ctx) {
        const [uid] = searchDeck(ctx, {
          filter: (d) => isBasicEnergy(d, 'Grass'),
          max: 1,
          message: 'Choose a Basic {G} Energy to attach',
        });
        if (uid) ctx.attachEnergy(uid, { player: ctx.me, zone: 'active' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
