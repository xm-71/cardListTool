import type { CardScript } from '@ptcg/engine';

export const name = 'Budew';
export const set = 'me02.5';
export const script: CardScript = {
  attacks: {
    // Itchy Pollen: during your opponent's next turn, they can't play any Item cards from their hand.
    0: { effect: (ctx) => ctx.lockItems(ctx.opp) },
  },
};
