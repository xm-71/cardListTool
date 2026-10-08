import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Mega Signal';
export const script: CardScript = {
  trainer: {
    play(ctx) {
      const [uid] = searchDeck(ctx, {
        filter: (d) => d.category === 'Pokemon' && d.isMega,
        max: 1,
        message: 'Choose a Mega Evolution Pokémon ex',
      });
      if (uid) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      ctx.shuffleDeck(ctx.me);
    },
  },
};
