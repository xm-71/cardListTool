import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = "Team Rocket's Petrel";
export const script: CardScript = {
  // Search your deck for a Trainer card.
  trainer: {
    play(ctx) {
      const [found] = searchDeck(ctx, {
        filter: (d) => d.category === 'Trainer',
        max: 1,
        message: 'Choose a Trainer card',
      });
      if (found) {
        ctx.reveal([found]);
        ctx.moveCard(found, { player: ctx.me, zone: 'hand' });
      }
      ctx.shuffleDeck(ctx.me);
    },
  },
};
