import type { CardScript } from '@ptcg/engine';
import { otherCardsInHand, searchDeck } from '../util.ts';

const KINDS = ['Item', 'Tool', 'Supporter', 'Stadium'] as const;

export const name = 'Secret Box';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => otherCardsInHand(ctx).length >= 3,
    play(ctx) {
      const discard = ctx.chooseCards({
        player: ctx.me,
        from: otherCardsInHand(ctx),
        min: 3,
        max: 3,
        message: 'Choose 3 cards to discard',
      });
      for (const uid of discard) ctx.moveCard(uid, { player: ctx.me, zone: 'discard' });
      const found: string[] = [];
      for (const kind of KINDS) {
        const [uid] = searchDeck(ctx, {
          filter: (d) => d.category === 'Trainer' && d.trainerType === kind,
          max: 1,
          message: `Choose a${kind === 'Item' ? 'n' : ''} ${kind === 'Tool' ? 'Pokémon Tool' : kind} card`,
        });
        if (uid) {
          found.push(uid);
          ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
        }
      }
      ctx.reveal(found);
      ctx.shuffleDeck(ctx.me);
    },
  },
};
