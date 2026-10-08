import type { CardScript } from '@ptcg/engine';

export const name = 'Eternatus';
export const script: CardScript = {
  attacks: {
    // Shatter
    0: { effect: (ctx) => ctx.discardStadium() },
    // Power Rush
    1: {
      effect(ctx) {
        if (!ctx.flipCoin()) {
          ctx.slot({ player: ctx.me, zone: 'active' }).cantAttackOnTurn = ctx.state.turn + 2;
          ctx.log("Eternatus can't attack during its owner's next turn");
        }
      },
    },
  },
};
