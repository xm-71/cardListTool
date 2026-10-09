import type { CardScript } from '@ptcg/engine';
import { defAt, refsOf } from '../util.ts';

export const name = 'Nidoking';
export const set = 'sv03.5';
export const script: CardScript = {
  // Enthusiastic King: with Nidoqueen in play, ignore all Energy in the costs of this Pokémon's attacks.
  modifyAttackCost(q) {
    const queen = refsOf(q.state, q.holder.player).some(
      (ref) => defAt(q.state, q.registry, ref)?.name === 'Nidoqueen',
    );
    return queen ? [] : q.cost;
  },
  attacks: {
    // Venomous Impact
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'poisoned') },
  },
};
