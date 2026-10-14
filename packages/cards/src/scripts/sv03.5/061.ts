import type { CardScript } from '@ptcg/engine';

export const name = 'Poliwhirl';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Frog Hop: flip a coin. If heads, this attack does 60 more damage.
    1: { damage: (ctx) => (ctx.flipCoin() ? 90 : 30) },
  },
};
