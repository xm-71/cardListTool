import type { CardScript } from '@ptcg/engine';

export const name = 'Murkrow';
export const set = 'me02';
export const script: CardScript = {
  attacks: {
    // Ambush: flip a coin. If heads, this attack does 20 more damage.
    0: { damage: (ctx) => (ctx.flipCoin() ? 30 : 10) },
  },
};
