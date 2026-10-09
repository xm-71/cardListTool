import type { CardScript } from '@ptcg/engine';
import { discardOpponentDeckTop } from '../util.ts';

export const name = 'Machamp';
export const set = 'sv03.5';
export const script: CardScript = {
  // Guts: if an attack's damage would Knock this Pokémon Out, flip a coin; on heads it survives with 10 HP left.
  survivesKnockout: (ctx) => ctx.flipCoin(),
  attacks: {
    // Mountain Chopping: discard the top 2 cards of your opponent's deck.
    0: { effect: (ctx) => discardOpponentDeckTop(ctx, 2) },
  },
};
