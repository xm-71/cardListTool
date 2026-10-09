import type { CardScript } from '@ptcg/engine';

export const name = 'Dragonair';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Aqua Slash: during your next turn, this Pokémon can't attack.
    1: {
      effect(ctx) {
        ctx.slot({ player: ctx.me, zone: 'active' }).cantAttackOnTurn = ctx.state.turn + 2;
        ctx.log("Dragonair can't attack during its owner's next turn");
      },
    },
  },
};
