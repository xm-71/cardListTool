import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy, searchDeck } from '../util.ts';

export const name = 'Fighting Gong';
export const script: CardScript = {
  trainer: {
    play(ctx) {
      const [uid] = searchDeck(ctx, {
        filter: (d) =>
          isBasicEnergy(d, 'Fighting') ||
          (d.category === 'Pokemon' && d.stage === 'Basic' && d.types.includes('Fighting')),
        max: 1,
        message: 'Choose a Basic {F} Energy or Basic {F} Pokémon',
      });
      if (uid) {
        ctx.reveal([uid]);
        ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      }
      ctx.shuffleDeck(ctx.me);
    },
  },
};
