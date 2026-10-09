import type { CardScript } from '@ptcg/engine';

export const name = 'Alakazam ex';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Mind Jack: 30 more damage for each of your opponent's Benched Pokémon.
    0: { damage: (ctx) => 90 + 30 * ctx.state.players[ctx.opp].bench.length },
    // Dimensional Hand: 120. "Can be used from the Bench" is not supported; it is used from the Active Spot.
    1: { damage: () => 120 },
  },
};
