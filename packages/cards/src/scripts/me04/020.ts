import type { CardScript } from '@ptcg/engine';

export const name = 'Froakie';
export const script: CardScript = {
  attacks: {
    // Collect: draw a card.
    0: { effect: (ctx) => void ctx.draw(ctx.me, 1) },
  },
};
