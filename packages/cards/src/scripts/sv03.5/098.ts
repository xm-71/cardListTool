import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy, searchDeck } from '../util.ts';

export const name = 'Krabby';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Salt Water: flip a coin; on heads attach up to 2 Basic {W} Energy from the deck to this Pokémon.
    0: {
      effect(ctx) {
        if (!ctx.flipCoin()) return;
        const picks = searchDeck(ctx, {
          filter: (d) => isBasicEnergy(d, 'Water'),
          max: 2,
          message: 'Choose up to 2 Basic {W} Energy to attach',
        });
        for (const uid of picks) ctx.attachEnergy(uid, { player: ctx.me, zone: 'active' });
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
