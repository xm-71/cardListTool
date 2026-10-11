import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Hilda';
export const script: CardScript = {
  // Search your deck for an Evolution Pokémon and an Energy card.
  trainer: {
    play(ctx) {
      const found = [
        ...searchDeck(ctx, {
          filter: (d) => d.category === 'Pokemon' && d.stage !== 'Basic',
          max: 1,
          message: 'Choose an Evolution Pokémon',
        }),
      ];
      for (const uid of found) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      const energy = searchDeck(ctx, {
        filter: (d) => d.category === 'Energy',
        max: 1,
        message: 'Choose an Energy card',
      });
      for (const uid of energy) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      if (found.length + energy.length > 0) ctx.reveal([...found, ...energy]);
      ctx.shuffleDeck(ctx.me);
    },
  },
};
