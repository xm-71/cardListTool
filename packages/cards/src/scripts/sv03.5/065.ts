import type { CardScript } from '@ptcg/engine';

export const name = 'Alakazam ex';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Mind Jack: 30 more damage for each of your opponent's Benched Pokémon.
    0: { damage: (ctx) => 90 + 30 * ctx.state.players[ctx.opp].bench.length },
    // Dimensional Hand: can be used even if this Pokémon is on the Bench.
    1: { fromBench: true, damage: () => 120 },
  },
};
