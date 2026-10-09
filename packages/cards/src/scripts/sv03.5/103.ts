import type { CardScript } from '@ptcg/engine';

export const name = 'Exeggutor';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Psychic: 30 more for each Energy attached to the Defending Pokémon.
    0: {
      damage: (ctx) => 30 + 30 * ctx.slot({ player: ctx.opp, zone: 'active' }).energy.length,
    },
  },
};
