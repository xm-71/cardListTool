import type { CardScript } from '@ptcg/engine';

export const name = 'Ninetales ex';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Heat Wave
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'burned') },
    // Mirrored Flames: 140 more if both players have the same number of cards in hand.
    1: {
      damage: (ctx) =>
        ctx.state.players[ctx.me].hand.length === ctx.state.players[ctx.opp].hand.length ? 220 : 80,
    },
  },
};
