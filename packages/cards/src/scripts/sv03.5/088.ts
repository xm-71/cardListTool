import type { CardScript } from '@ptcg/engine';

export const name = 'Grimer';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Gummy Press: the Defending Pokémon's Retreat Cost is {C} more during the opponent's next turn.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.opp, zone: 'active' }, 'retreatCostMore', 1) },
  },
};
