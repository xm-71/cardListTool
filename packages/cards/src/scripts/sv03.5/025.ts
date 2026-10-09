import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy, searchDeck } from '../util.ts';

export const name = 'Pikachu';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Charge: search for a Basic {L} Energy and attach it to this Pokémon.
    0: {
      effect(ctx) {
        const [uid] = searchDeck(ctx, {
          filter: (d) => isBasicEnergy(d, 'Lightning'),
          max: 1,
          message: 'Choose a Basic {L} Energy to attach',
        });
        if (uid) ctx.attachEnergy(uid, { player: ctx.me, zone: 'active' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
