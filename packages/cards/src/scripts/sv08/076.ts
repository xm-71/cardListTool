import type { CardScript } from '@ptcg/engine';
import { defAt } from '../util.ts';

export const name = 'Latias ex';
export const set = 'sv08';
export const script: CardScript = {
  // Skyliner: your Basic Pokémon in play have no Retreat Cost.
  modifyAllRetreatCosts: (q) => (defAt(q.state, q.registry, q.slot)?.stage === 'Basic' ? 0 : q.cost),
  attacks: {
    // Eon Blade: during your next turn, this Pokémon can't attack.
    0: {
      effect(ctx) {
        ctx.slot({ player: ctx.me, zone: 'active' }).cantAttackOnTurn = ctx.state.turn + 2;
      },
    },
  },
};
