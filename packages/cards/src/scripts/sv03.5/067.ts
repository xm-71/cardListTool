import type { CardScript } from '@ptcg/engine';
import { discardOpponentDeckTop } from '../util.ts';

export const name = 'Machoke';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Mountain Ramming: discard the top card of your opponent's deck.
    0: { effect: (ctx) => discardOpponentDeckTop(ctx, 1) },
  },
};
