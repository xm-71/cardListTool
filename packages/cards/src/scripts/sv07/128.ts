import type { CardScript } from '@ptcg/engine';

export const name = 'Terapagos ex';
export const set = 'sv07';
export const script: CardScript = {
  attacks: {
    // Unified Beatdown: if you go second, you can't use this attack during your first turn. 30 damage for each of your
    // Benched Pokémon.
    0: {
      canUse: (ctx) => !(ctx.me !== ctx.state.first && ctx.state.turn === 2),
      damage: (ctx) => 30 * ctx.state.players[ctx.me].bench.length,
    },
    // Crown Opal: during your opponent's next turn, prevent all damage done to this Pokémon by attacks from Basic
    // non-{C} Pokémon. The engine's marker prevents damage from every Basic Pokémon, {C} ones included.
    1: {
      effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'preventFromBasic'),
    },
  },
};
