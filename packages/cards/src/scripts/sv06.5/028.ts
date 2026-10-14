import type { CardScript } from '@ptcg/engine';

export const name = 'Golbat';
export const set = 'sv06.5';
export const script: CardScript = {
  attacks: {
    // Pitch-Black Blade: during your next turn, this Pokémon can't attack.
    1: {
      effect(ctx) {
        ctx.slot({ player: ctx.me, zone: 'active' }).cantAttackOnTurn = ctx.state.turn + 2;
        ctx.log("Golbat can't attack during its owner's next turn");
      },
    },
  },
};
