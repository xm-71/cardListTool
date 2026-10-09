import type { CardScript } from '@ptcg/engine';

export const name = 'Rhydon';
export const script: CardScript = {
  attacks: {
    // Charismatic Drill: 140 more if you played Giovanni's Charisma this turn.
    1: { damage: (ctx) => (ctx.playedSupporterThisTurn("Giovanni's Charisma") ? 180 : 40) },
  },
};
