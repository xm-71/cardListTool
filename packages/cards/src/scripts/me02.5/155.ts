import type { CardScript } from '@ptcg/engine';

export const name = "N's Zekrom";
export const set = 'me02.5';
export const script: CardScript = {
  attacks: {
    // Shred: this attack's damage isn't affected by any effects on your opponent's Active Pokémon.
    0: { damage: () => ({ amount: 70, ignoreWR: false, ignoreDefenderEffects: true }) },
    // Rampaging Thunder: during your next turn, this Pokémon can't use attacks.
    1: {
      effect(ctx) {
        const active = ctx.state.players[ctx.me].active;
        if (active) active.cantAttackOnTurn = ctx.state.turn + 2;
      },
    },
  },
};
