import type { CardScript } from '@ptcg/engine';

export const name = "N's Reshiram";
export const set = 'sv09';
export const script: CardScript = {
  attacks: {
    // Powerful Rage: 20 damage for each damage counter on this Pokémon.
    0: { damage: (ctx) => 20 * ((ctx.state.players[ctx.me].active?.damage ?? 0) / 10) },
  },
};
