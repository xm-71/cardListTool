import type { CardScript } from '@ptcg/engine';

export const name = 'Muk';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Sticky Jail: the Defending Pokémon's attacks cost {C} more and its Retreat Cost is {C} more during the opponent's next turn.
    0: {
      effect(ctx) {
        const target = { player: ctx.opp, zone: 'active' } as const;
        ctx.addMarker(target, 'attackCostMore', 1);
        ctx.addMarker(target, 'retreatCostMore', 1);
      },
    },
  },
};
