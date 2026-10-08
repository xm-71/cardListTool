import type { CardScript } from '@ptcg/engine';

export const name = 'Chi-Yu';
export const script: CardScript = {
  attacks: {
    // Scorching Earth: discard the opponent's Stadium; then they can't play Stadiums next turn.
    0: {
      effect(ctx) {
        if (ctx.state.stadium?.owner !== ctx.opp) return;
        ctx.discardStadium();
        ctx.lockStadium(ctx.opp);
      },
    },
  },
};
