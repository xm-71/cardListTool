import type { CardScript } from '@ptcg/engine';

export const name = 'Slowbro';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Big Yawn: both Active Pokémon are now Asleep.
    0: {
      effect(ctx) {
        ctx.applyCondition({ player: ctx.me, zone: 'active' }, 'asleep');
        ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'asleep');
      },
    },
    // Laid-Back Tackle: does nothing if this Pokémon evolved during this turn.
    1: {
      damage: (ctx) =>
        ctx.slot({ player: ctx.me, zone: 'active' }).evolvedTurn === ctx.state.turn ? 0 : 160,
    },
  },
};
