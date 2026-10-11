import type { CardScript } from '@ptcg/engine';
import { searchDeck } from '../util.ts';

export const name = 'Meowth ex';
export const set = 'me03';
export const script: CardScript = {
  // Last-Ditch Catch: when played from your hand onto your Bench, search your deck for a Supporter.
  onPlayToBench: {
    canUse: (ctx) => !ctx.usedAbilityNameThisTurn('Last-Ditch'),
    use(ctx) {
      ctx.markAbilityName('Last-Ditch');
      const [found] = searchDeck(ctx, {
        filter: (d) => d.category === 'Trainer' && d.trainerType === 'Supporter',
        max: 1,
        message: 'Choose a Supporter',
      });
      if (found) {
        ctx.reveal([found]);
        ctx.moveCard(found, { player: ctx.me, zone: 'hand' });
      }
      ctx.shuffleDeck(ctx.me);
    },
  },
  attacks: {
    // Tuck Tail: put this Pokémon and all attached cards into your hand.
    0: { effect: (ctx) => ctx.returnSlotToHand({ player: ctx.me, zone: 'active' }) },
  },
};
