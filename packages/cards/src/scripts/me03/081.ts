import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Poké Pad';
export const script: CardScript = {
  // Search your deck for a Pokémon that doesn't have a Rule Box.
  trainer: {
    play(ctx) {
      const [found] = searchDeck(ctx, {
        filter: (d) => d.category === 'Pokemon' && !d.isEx,
        max: 1,
        message: 'Choose a Pokémon without a Rule Box',
      });
      if (found) {
        ctx.reveal([found]);
        ctx.moveCard(found, { player: ctx.me, zone: 'hand' });
      }
      ctx.shuffleDeck(ctx.me);
    },
  },
};
