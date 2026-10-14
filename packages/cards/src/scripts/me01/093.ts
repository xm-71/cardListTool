import type { CardScript } from '@ptcg/engine';

export const name = 'Steelix';
export const script: CardScript = {
  attacks: {
    // Welcoming Tail: if you have exactly 6 Prize cards remaining, this attack does 200 more damage.
    0: { damage: (ctx) => (ctx.state.players[ctx.me].prizes.length === 6 ? 240 : 40) },
  },
};
