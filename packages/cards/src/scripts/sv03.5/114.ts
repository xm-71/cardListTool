import type { CardScript } from '@ptcg/engine';

export const name = 'Tangela';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Tactful Tangling: 60 more if you played Erika's Invitation this turn.
    0: { damage: (ctx) => (ctx.playedSupporterThisTurn("Erika's Invitation") ? 70 : 10) },
  },
};
