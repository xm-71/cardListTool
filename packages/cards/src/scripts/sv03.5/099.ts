import type { CardScript } from '@ptcg/engine';

export const name = 'Kingler';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Hammer Arm: discard the top card of your opponent's deck.
    0: {
      effect(ctx) {
        const opp = ctx.state.players[ctx.opp];
        const top = opp.deck.shift();
        if (top) {
          opp.discard.push(top);
          ctx.log(`${ctx.def(top).name} is discarded from the top of the opponent's deck`);
        }
      },
    },
  },
};
