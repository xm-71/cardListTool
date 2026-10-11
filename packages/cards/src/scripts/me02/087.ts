import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Dawn';
export const script: CardScript = {
  // Search your deck for a Basic, a Stage 1 and a Stage 2 Pokémon.
  trainer: {
    play(ctx) {
      const found: string[] = [];
      for (const stage of ['Basic', 'Stage1', 'Stage2'] as const) {
        const [uid] = searchDeck(ctx, {
          filter: (d) => d.category === 'Pokemon' && d.stage === stage,
          max: 1,
          message: `Choose a ${stage === 'Basic' ? 'Basic' : stage === 'Stage1' ? 'Stage 1' : 'Stage 2'} Pokémon`,
        });
        if (uid) {
          found.push(uid);
          ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
        }
      }
      if (found.length > 0) ctx.reveal(found);
      ctx.shuffleDeck(ctx.me);
    },
  },
};
