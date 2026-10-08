import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Arven';
export const script: CardScript = {
  trainer: {
    play(ctx) {
      const [item] = searchDeck(ctx, {
        filter: (d) => d.category === 'Trainer' && d.trainerType === 'Item',
        max: 1,
        message: 'Choose an Item card',
      });
      if (item) ctx.moveCard(item, { player: ctx.me, zone: 'hand' });
      const [tool] = searchDeck(ctx, {
        filter: (d) => d.category === 'Trainer' && d.trainerType === 'Tool',
        max: 1,
        message: 'Choose a Pokémon Tool card',
      });
      if (tool) ctx.moveCard(tool, { player: ctx.me, zone: 'hand' });
      ctx.reveal([item, tool].filter((u): u is string => !!u));
      ctx.shuffleDeck(ctx.me);
    },
  },
};
