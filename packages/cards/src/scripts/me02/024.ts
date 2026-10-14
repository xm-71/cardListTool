import type { CardScript } from '@ptcg/engine';

export const name = 'Piloswine';
export const script: CardScript = {
  attacks: {
    // Rising Lunge: flip a coin. If heads, this attack does 30 more damage.
    0: { damage: (ctx) => (ctx.flipCoin() ? 60 : 30) },
  },
};
