import type { CardScript } from '@ptcg/engine';

export const name = 'Zacian';
export const script: CardScript = {
  attacks: {
    // Limit Break
    0: { damage: (ctx) => 50 + (ctx.state.players[ctx.opp].prizes.length <= 3 ? 90 : 0) },
  },
};
